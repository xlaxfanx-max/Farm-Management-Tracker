"""Block report card — imported grades, not computed ones.

The scoring engine lives outside this platform, in the pack-reports project. It
is built from 2,112 source PDFs by a long extraction pipeline and is guarded by
its own 37-check verification harness. Re-implementing its arithmetic here
would create two implementations that must agree forever, and any drift between
them produces a different letter for the same block — which is the one failure
this asset cannot survive.

So the platform IMPORTS. It renders grades, shows what is gated and why, and
carries the evidence trail. It does not grade.

One thing flows the other way: acres. Acres is the single grower input, two of
the five grades are per-acre, and the platform is the right place to edit it.
The platform exports acres back to the engine, which regrades and produces a
new bundle. It never regrades locally — a grade computed here is a number no
verify check has ever seen.

Design rules that are load-bearing:

* **A dash is not a zero.** Grades are nullable. San Antonio Creek has no trend
  grades at all (too few seasons) and its GPA is averaged over three grades,
  not five with two zeros. `grades_on_file` records the denominator so the GPA
  is auditable rather than asserted.
* **Gate reasons are rendered verbatim.** They are written by the engine and
  say precisely what is missing. Regenerating or summarising them would put a
  different claim on screen than the one the engine actually made.
* **Imports are snapshots.** A bundle lands as a whole, is verifiable, and only
  becomes visible when published. The previous snapshot stays live until then,
  so a bad import cannot silently change a published grade.
"""

from django.db import models


class BlockScoreSnapshot(models.Model):
    """One import of the scoring engine's output.

    Carries the engine's own verification tally so a card can state, on its
    face, whether the run behind it passed. An import whose checks did not all
    pass can only be forced in, and is badged everywhere it appears.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='block_score_snapshots'
    )

    imported_at = models.DateTimeField(auto_now_add=True)
    engine_version = models.CharField(max_length=50, blank=True)
    bundle_generated_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the exporting side built this bundle",
    )
    pack_db_sha256 = models.CharField(
        max_length=64, blank=True,
        help_text="Hash of the source database, so a card traces to an exact build",
    )

    verify_checks_passed = models.PositiveSmallIntegerField(default=0)
    verify_checks_total = models.PositiveSmallIntegerField(default=0)
    forced = models.BooleanField(
        default=False,
        help_text="Imported despite failing verification. Badge every figure.",
    )

    grade_window_start = models.PositiveSmallIntegerField(null=True, blank=True)
    grade_window_end = models.PositiveSmallIntegerField(null=True, blank=True)
    trend_window_start = models.PositiveSmallIntegerField(null=True, blank=True)
    trend_window_end = models.PositiveSmallIntegerField(null=True, blank=True)

    is_published = models.BooleanField(
        default=False, db_index=True,
        help_text="Only one snapshot is published at a time; it is what the UI shows",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-imported_at']
        indexes = [models.Index(fields=['company', '-imported_at'])]

    def __str__(self):
        state = 'published' if self.is_published else 'staged'
        return f'Snapshot {self.pk} ({state}, {self.verify_summary})'

    @property
    def verify_summary(self):
        return f'{self.verify_checks_passed}/{self.verify_checks_total}'

    @property
    def fully_verified(self):
        return (
            self.verify_checks_total > 0
            and self.verify_checks_passed == self.verify_checks_total
        )

    def publish(self):
        """Make this the live snapshot, atomically replacing the previous one."""
        type(self).objects.filter(
            company=self.company, is_published=True
        ).exclude(pk=self.pk).update(is_published=False)
        self.is_published = True
        self.save(update_fields=['is_published'])


class ScoringUnit(models.Model):
    """A block as the scoring engine knows it, e.g. 'SAT-LEM-Block1C'.

    In the engine this identity is free text repeated across four tables with no
    referential integrity — it lives only in a crosswalk spreadsheet. Promoting
    it to a row with a foreign key is the one piece of modelling the platform
    genuinely adds.

    farm and field are nullable on purpose. A card renders from the engine's own
    identifiers whether or not anyone has matched it to a Field yet, and a wrong
    automatic match is worse than no match.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='scoring_units'
    )
    uid = models.CharField(
        max_length=64,
        help_text="Engine unit id, {RANCH3}-{CROP}-{Block}",
    )
    display_name = models.CharField(
        max_length=200, blank=True, help_text="e.g. 'Saticoy · Block 1B'"
    )
    ranch_code = models.CharField(max_length=8, blank=True)
    crop_code = models.CharField(max_length=8, blank=True)
    block_label = models.CharField(max_length=64, blank=True)

    farm = models.ForeignKey(
        'Farm', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='scoring_units',
    )
    field = models.ForeignKey(
        'Field', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='scoring_units',
    )
    mapping_confirmed = models.BooleanField(
        default=False,
        help_text="A person confirmed this unit is that Field. Imports never overwrite a confirmed mapping.",
    )

    is_active = models.BooleanField(default=True)
    first_year = models.PositiveSmallIntegerField(null=True, blank=True)
    last_year = models.PositiveSmallIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['uid']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'uid'], name='uniq_scoring_unit_company_uid'
            ),
        ]

    def __str__(self):
        return self.display_name or self.uid


class BlockScorecard(models.Model):
    """The five letter grades for one block in one snapshot.

    Every grade is nullable because the engine legitimately declines to grade:
    San Antonio Creek has too few seasons for a trend. A null renders as a dash
    and is excluded from the GPA denominator. Storing a zero instead would turn
    'we do not know' into 'it failed', which is the difference between a card a
    grower trusts and one they argue with.
    """

    GRADE_CHOICES = [(g, g) for g in ('A', 'B', 'C', 'D', 'F')]

    snapshot = models.ForeignKey(
        BlockScoreSnapshot, on_delete=models.CASCADE, related_name='scorecards'
    )
    unit = models.ForeignKey(
        ScoringUnit, on_delete=models.CASCADE, related_name='scorecards'
    )

    overall = models.CharField(
        max_length=3, blank=True, help_text="Letter with +/-, e.g. 'A−', 'B+'"
    )
    gpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    grades_on_file = models.PositiveSmallIntegerField(
        default=0, help_text="How many of the five graded — the GPA denominator"
    )

    acres = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    acres_basis = models.CharField(
        max_length=200, blank=True,
        help_text="What acreage the grades were computed against, frozen at import",
    )

    yield_grade = models.CharField(max_length=1, choices=GRADE_CHOICES, blank=True)
    yield_ctn_ac = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    yield_pct_of_standard = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)

    revenue_grade = models.CharField(max_length=1, choices=GRADE_CHOICES, blank=True)
    revenue_per_acre = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    revenue_pct_of_standard = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)

    quality_grade = models.CharField(max_length=1, choices=GRADE_CHOICES, blank=True)
    fresh_packout_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    quality_trend_grade = models.CharField(max_length=1, choices=GRADE_CHOICES, blank=True)
    quality_trend_pts_yr = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    size_trend_grade = models.CharField(max_length=1, choices=GRADE_CHOICES, blank=True)
    money_share_trend_pts_yr = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    avg_size = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    money_size_share_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    avg_size_drift_counts_yr = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    # Pick timing is shown as a picture, never a grade — a letter here would put
    # blame on the grower for the packinghouse's scheduling.
    timing_score = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True,
        help_text="Volume-weighted value of the block's pick months (100 = season average)",
    )
    peak_share_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    strong_share_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    soft_share_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    flush_share_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    picks_per_season = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    note = models.TextField(blank=True)

    class Meta:
        ordering = ['-gpa', 'unit__uid']
        constraints = [
            models.UniqueConstraint(
                fields=['snapshot', 'unit'], name='uniq_scorecard_snapshot_unit'
            ),
        ]
        indexes = [models.Index(fields=['snapshot', '-gpa'])]

    def __str__(self):
        return f'{self.unit.uid}: {self.overall or "—"}'

    @property
    def graded_letters(self):
        """The grades actually on file, in card order."""
        return [
            g for g in (
                self.yield_grade, self.revenue_grade, self.quality_grade,
                self.quality_trend_grade, self.size_trend_grade,
            ) if g
        ]


class BlockSeasonMetric(models.Model):
    """One block-season row behind the grades.

    `revenue_note` matters: 11 of the 85 season rows fall back to a printed
    statement total rather than a reconciled charge tail. Those must render
    flagged — the figure is real, but it did not pass the same reconciliation
    as the others.
    """

    snapshot = models.ForeignKey(
        BlockScoreSnapshot, on_delete=models.CASCADE, related_name='season_metrics'
    )
    unit = models.ForeignKey(
        ScoringUnit, on_delete=models.CASCADE, related_name='season_metrics'
    )
    season = models.PositiveSmallIntegerField()

    packed_cartons = models.DecimalField(max_digits=12, decimal_places=1, null=True, blank=True)
    cartons_per_acre = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    pct_of_standard = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)

    pool_revenue = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    revenue_per_acre = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    season_standard_rev_per_acre = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    fresh_packout_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    avg_size = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    money_size_share_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    timing_score = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)

    pick_rounds = models.PositiveSmallIntegerField(null=True, blank=True)
    pick_months = models.CharField(max_length=120, blank=True)

    revenue_note = models.CharField(
        max_length=200, blank=True,
        help_text="Non-empty means the revenue figure did NOT come from a reconciled charge tail",
    )

    class Meta:
        ordering = ['unit__uid', 'season']
        constraints = [
            models.UniqueConstraint(
                fields=['snapshot', 'unit', 'season'],
                name='uniq_season_metric_snapshot_unit_season',
            ),
        ]
        indexes = [models.Index(fields=['snapshot', 'season'])]

    def __str__(self):
        return f'{self.unit.uid} {self.season}'


class BlockScoreGate(models.Model):
    """Why a factor did not score, in the engine's own words.

    Of 60 units the engine scores P1 on 20 and P2 on 14; the rest carry a
    reason. Those reasons are the most useful thing on the whole card — they
    are a ranked list of what unlocks the next tranche of grades — so they are
    stored verbatim and never regenerated.
    """

    snapshot = models.ForeignKey(
        BlockScoreSnapshot, on_delete=models.CASCADE, related_name='gates'
    )
    unit = models.ForeignKey(
        ScoringUnit, on_delete=models.CASCADE, related_name='gates'
    )
    subscore = models.CharField(
        max_length=8, help_text="P1..P5, PERF, or a sub-factor like P3a"
    )
    score = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    value_basis = models.CharField(max_length=200, blank=True)
    gate_reason = models.TextField(
        blank=True, help_text="Verbatim from the engine. Never rewritten."
    )

    class Meta:
        ordering = ['unit__uid', 'subscore']
        constraints = [
            models.UniqueConstraint(
                fields=['snapshot', 'unit', 'subscore'],
                name='uniq_gate_snapshot_unit_subscore',
            ),
        ]
        indexes = [models.Index(fields=['snapshot', 'subscore'])]

    def __str__(self):
        return f'{self.unit.uid} {self.subscore}'

    @property
    def is_gated(self):
        return self.score is None


class BlockScoreBenchmark(models.Model):
    """The constants the grades are measured against, and how firm each is.

    Seven of the 101 are still DEFAULT — including the 814 ctn/ac standard that
    is the denominator of two of the five grades, and all four P2H margin band
    floors. Any percentage computed against a DEFAULT constant has to say so on
    screen; otherwise the card asserts a precision it does not have.
    """

    snapshot = models.ForeignKey(
        BlockScoreSnapshot, on_delete=models.CASCADE, related_name='benchmarks'
    )
    factor = models.CharField(max_length=16)
    parameter = models.CharField(max_length=64)
    value = models.CharField(max_length=200)
    unit = models.CharField(max_length=32, blank=True)
    source = models.TextField(blank=True)
    status = models.CharField(
        max_length=16, db_index=True,
        help_text="LOCKED / VERIFIED / DEFAULT / REFERENCE / NOTE / PLACEHOLDER",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['factor', 'parameter']
        constraints = [
            models.UniqueConstraint(
                fields=['snapshot', 'factor', 'parameter'],
                name='uniq_benchmark_snapshot_factor_parameter',
            ),
        ]

    def __str__(self):
        return f'{self.factor}.{self.parameter} = {self.value} ({self.status})'

    @property
    def is_provisional(self):
        return self.status in ('DEFAULT', 'PLACEHOLDER')


class BlockEvidenceRef(models.Model):
    """A pointer to the source document behind a figure.

    The engine's audit folder is ~133 MB of rendered page images and cannot
    travel with a web app, so the platform carries the citation without the
    image: which document, which pages, whether it was counted, whether it
    needs review. `relpath` is normalised to forward slashes on the way in —
    the engine stores Windows separators, which is what breaks its own
    verification when run anywhere else.
    """

    snapshot = models.ForeignKey(
        BlockScoreSnapshot, on_delete=models.CASCADE, related_name='evidence'
    )
    unit = models.ForeignKey(
        ScoringUnit, on_delete=models.CASCADE, related_name='evidence'
    )

    doc_id = models.IntegerField(help_text="Engine document id")
    family = models.CharField(max_length=24, blank=True, help_text="pool / wash / pick")
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    relpath = models.CharField(max_length=500, blank=True)
    page_start = models.PositiveSmallIntegerField(null=True, blank=True)
    page_end = models.PositiveSmallIntegerField(null=True, blank=True)
    canonical = models.BooleanField(default=True)
    needs_review = models.BooleanField(
        default=False, db_index=True,
        help_text="Counted deliberately, but flagged by the engine's reconciliation",
    )
    cartons = models.DecimalField(max_digits=12, decimal_places=1, null=True, blank=True)

    statement = models.ForeignKey(
        'PackinghouseStatement', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='block_evidence',
        help_text="Future seam: links a citation to a statement held in the platform",
    )

    class Meta:
        ordering = ['unit__uid', '-year', 'doc_id']
        indexes = [
            models.Index(fields=['snapshot', 'unit']),
            models.Index(fields=['snapshot', 'needs_review']),
        ]

    def __str__(self):
        return f'{self.unit.uid} doc {self.doc_id}'
