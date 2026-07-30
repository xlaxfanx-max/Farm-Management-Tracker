"""Extraction-figure integrity.

These tests pin the two behaviours that make the live Finch well data usable:

1. An agency-billed acre-feet figure is never recomputed from the meter delta.
   The water agencies print acre-feet directly and that is the number Finch was
   billed on. The registers behind those figures are not in acre-feet — they
   run x0.001, x0.01, gallons, or cubic-feet x10 depending on the well — and
   they roll over at 1,000,000. Recomputing one with the wrong register scale
   silently replaces a real 59.14 AF with 18,386 AF.

2. Only billing rows are summed. UWCD reads the meter quarterly but bills
   semi-annually: the June row spans December->June and already contains March,
   and the December row spans June->December and already contains September.
   Summing all four rows double-counts the year.

The numbers used here are the real ones from the production water fixture and
from 'Water Usage Summary V1.0' ('AF by Well'), so a regression shows up as a
figure Finch would recognise as wrong.
"""

from datetime import date
from decimal import Decimal

from django.test import TestCase

from api.models import WellReading
from api.tests.factories import TestDataFactory


class AgencyBilledExtractionTests(TestCase):
    """A figure printed by the water agency is authoritative."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company = self.factory.create_company(name='Finch Test Co')
        self.farm = self.factory.create_farm(self.company, name='Saticoy')
        # Saticoy FIN0010 as it exists in production: the register reads in
        # thousandths of an acre-foot but is configured as plain acre-feet.
        # That misconfiguration is exactly what makes the guard necessary.
        self.well = self.factory.create_water_source(
            farm=self.farm,
            name='FIN0010',
            gsa='uwcd',
            state_well_number='03N22W34Q03S',
            flowmeter_units='acre_feet',
            flowmeter_multiplier=Decimal('1.0000'),
        )

    def test_agency_billed_reading_survives_a_save(self):
        """The production hazard, reproduced exactly.

        FIN0010 2025-09-30 -> 2025-12-31 is a meter delta of 18,386 register
        units against 59.14 acre-feet actually billed. Re-saving the December
        row must leave 59.14 alone.
        """
        WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 9, 30),
            meter_reading=Decimal('864432'),
            extraction_acre_feet=Decimal('45.880000'),
            af_source='agency_billed',
        )
        december = WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 12, 31),
            meter_reading=Decimal('882818'),
            extraction_acre_feet=Decimal('59.140000'),
            af_source='agency_billed',
        )

        december.notes = 'edited in the UI'
        december.save()
        december.refresh_from_db()

        self.assertEqual(december.extraction_acre_feet, Decimal('59.140000'))
        # The raw delta is what would have been written instead.
        self.assertNotEqual(december.extraction_acre_feet, Decimal('18386'))

    def test_agency_billed_reading_does_not_produce_a_seven_figure_fee(self):
        """The fee follows the acre-feet, so protecting one protects the other."""
        self.well.base_extraction_rate = Decimal('192.34')
        self.well.save()

        WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 9, 30),
            meter_reading=Decimal('864432'),
            extraction_acre_feet=Decimal('45.880000'),
            af_source='agency_billed',
        )
        december = WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 12, 31),
            meter_reading=Decimal('882818'),
            extraction_acre_feet=Decimal('59.140000'),
            af_source='agency_billed',
        )
        december.save()
        december.refresh_from_db()

        # 59.14 AF x $192.34 = $11,375. The unguarded path produced $3,536,363.
        self.assertLess(december.base_fee, Decimal('20000'))

    def test_meter_derived_reading_is_still_recomputed(self):
        """The guard must not freeze readings that genuinely are meter-derived."""
        WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 1, 31),
            meter_reading=Decimal('100'),
            af_source='meter_derived',
        )
        later = WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 2, 28),
            meter_reading=Decimal('112'),
            af_source='meter_derived',
        )
        later.refresh_from_db()

        self.assertEqual(later.previous_reading, Decimal('100.0000'))
        self.assertEqual(later.extraction_acre_feet, Decimal('12.000000'))


class MeterRolloverTests(TestCase):
    """A totalizer that wraps must not produce a negative extraction."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company = self.factory.create_company()
        self.farm = self.factory.create_farm(self.company)
        self.well = self.factory.create_water_source(
            farm=self.farm,
            flowmeter_units='acre_feet',
            flowmeter_multiplier=Decimal('1.0000'),
        )

    def test_rollover_is_inferred_when_the_meter_wraps(self):
        """A 6-digit register wrapping past 1,000,000 is inferred, not flagged.

        The production data contains 11 of these — FIN0010 alone shows a
        -910,038 delta — and meter_rollover is null on all 343 rows.
        """
        WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 1, 31),
            meter_reading=Decimal('999000'),
            af_source='meter_derived',
        )
        wrapped = WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 2, 28),
            meter_reading=Decimal('1500'),
            af_source='meter_derived',
        )
        wrapped.refresh_from_db()

        # (1,000,000 - 999,000) + 1,500
        self.assertEqual(wrapped.extraction_acre_feet, Decimal('2500.000000'))
        self.assertGreater(wrapped.extraction_acre_feet, Decimal('0'))

    def test_unexplained_backwards_reading_records_nothing(self):
        """A meter replaced or reset mid-series is a human problem.

        Recording a negative extraction would quietly subtract from the ranch
        total, so record nothing and leave it visible instead.
        """
        WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 1, 31),
            meter_reading=Decimal('5000'),
            af_source='meter_derived',
        )
        replaced = WellReading.objects.create(
            water_source=self.well,
            reading_date=date(2025, 2, 28),
            meter_reading=Decimal('120'),
            meter_rollover=Decimal('1000'),  # asserted, and too small to explain it
            af_source='meter_derived',
        )
        replaced.refresh_from_db()

        self.assertIsNone(replaced.extraction_acre_feet)


class BillingRowTests(TestCase):
    """Interim reads are contained in the billing row that follows them."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company = self.factory.create_company()
        self.farm = self.factory.create_farm(self.company, name='Saticoy')
        self.well = self.factory.create_water_source(
            farm=self.farm,
            name='FIN0002',
            gsa='uwcd',
            flowmeter_units='acre_feet',
        )
        # Saticoy FIN0002, calendar 2022. 'AF by Well' reports 32.72 for the
        # year; naively summing all four rows gives 59.46.
        for reading_date, meter, af, billing in [
            (date(2022, 3, 31), '85062', '26.740000', False),
            (date(2022, 6, 30), '91037', '32.720000', True),
            (date(2022, 9, 30), '91037', '0.000000', False),
            (date(2022, 12, 31), '91037', '0.000000', True),
        ]:
            WellReading.objects.create(
                water_source=self.well,
                reading_date=reading_date,
                meter_reading=Decimal(meter),
                extraction_acre_feet=Decimal(af),
                af_source='agency_billed',
                is_billing_row=billing,
            )

    def test_billing_rows_reproduce_the_workbook_total(self):
        from django.db.models import Sum

        billed = WellReading.objects.filter(
            water_source=self.well,
            is_billing_row=True,
        ).aggregate(total=Sum('extraction_acre_feet'))['total']

        self.assertEqual(billed, Decimal('32.720000'))

    def test_summing_every_row_is_the_bug_this_prevents(self):
        from django.db.models import Sum

        naive = WellReading.objects.filter(
            water_source=self.well,
        ).aggregate(total=Sum('extraction_acre_feet'))['total']

        self.assertEqual(naive, Decimal('59.460000'))
        self.assertGreater(naive, Decimal('32.720000'))

    def test_water_source_ytd_helper_uses_billing_rows_only(self):
        """get_ytd_extraction_af is what the well list and detail pages call."""
        recent = WellReading.objects.create(
            water_source=self.well,
            reading_date=date.today(),
            meter_reading=Decimal('99999'),
            extraction_acre_feet=Decimal('10.000000'),
            af_source='agency_billed',
            is_billing_row=False,
        )
        self.assertEqual(self.well.get_ytd_extraction_af(), Decimal('0'))

        recent.is_billing_row = True
        recent.save()
        self.assertEqual(self.well.get_ytd_extraction_af(), Decimal('10.000000'))
