"""Seed a demo company with realistic citrus-operation data.

Creates (idempotently — safe to re-run):
- Demo company + login (demo@grovemaster.com / demo1234)
- Two ranches with GPS, four blocks with crops
- Spray products with REI/PHI/cost, several application events
  (one recent enough to show a live REI countdown)
- Harvests, a well with water tests, compliance deadlines
- A packinghouse pool with one settlement so Crop Reports has data

Usage:
    python run_dev_sqlite.py seed_demo_data
"""
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone


DEMO_EMAIL = 'demo@grovemaster.com'
DEMO_PASSWORD = 'demo1234'


class Command(BaseCommand):
    help = 'Seed demo data for local development and product demos'

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model

        from api.models import (
            ApplicationEvent, Company, CompanyMembership, ComplianceDeadline,
            ComplianceProfile, Farm, Field, Harvest, Packinghouse, Pool,
            PoolSettlement, Product, Role, TankMixItem, WaterSource, WaterTest,
        )

        User = get_user_model()

        company, _ = Company.objects.get_or_create(
            name='Demo Grove Co',
            defaults={'county': 'ventura', 'subscription_tier': 'professional'},
        )

        user = User.objects.filter(email=DEMO_EMAIL).first()
        if not user:
            user = User.objects.create_user(
                email=DEMO_EMAIL, password=DEMO_PASSWORD,
                first_name='Demo', last_name='Grower',
            )
        user.current_company = company
        user.save(update_fields=['current_company'])

        role, _ = Role.objects.get_or_create(
            name='Owner', defaults={'codename': 'owner', 'is_system_role': True},
        )
        CompanyMembership.objects.get_or_create(
            user=user, company=company, defaults={'role': role, 'is_active': True},
        )

        # --- Ranches & blocks -------------------------------------------------
        north, _ = Farm.objects.get_or_create(
            company=company, name='North Ranch',
            defaults={
                'county': 'ventura', 'address': '1200 Grove Rd, Ojai, CA',
                'gps_latitude': Decimal('34.4480000'),
                'gps_longitude': Decimal('-119.2430000'),
            },
        )
        south, _ = Farm.objects.get_or_create(
            company=company, name='South Ranch',
            defaults={
                'county': 'ventura', 'address': '480 Creek Ln, Santa Paula, CA',
                'gps_latitude': Decimal('34.3540000'),
                'gps_longitude': Decimal('-119.0590000'),
            },
        )

        def block(farm, name, acres, crop, lat, lon):
            f, _ = Field.objects.get_or_create(
                farm=farm, name=name,
                defaults={
                    'total_acres': Decimal(acres),
                    'current_crop': crop,
                    'county': farm.county,
                    'gps_latitude': Decimal(lat),
                    'gps_longitude': Decimal(lon),
                },
            )
            return f

        b1 = block(north, 'Block 1 — Navels', '18.50', 'navel_orange', '34.4490000', '-119.2440000')
        b2 = block(north, 'Block 2 — Navels', '12.00', 'navel_orange', '34.4470000', '-119.2410000')
        b3 = block(north, 'Block 3 — Lemons', '9.75', 'lemon', '34.4500000', '-119.2400000')
        b4 = block(south, 'Creek Block — Valencias', '22.30', 'valencia_orange', '34.3550000', '-119.0600000')

        # --- Products ---------------------------------------------------------
        def product(name, ptype, epa, rei, phi, cost, cost_unit, moa=None):
            p, _ = Product.objects.get_or_create(
                product_name=name,
                defaults={
                    'product_type': ptype,
                    'epa_registration_number': epa,
                    'rei_hours': rei,
                    'phi_days': phi,
                    'cost_per_unit': cost,
                    'cost_unit': cost_unit,
                },
            )
            return p

        spinosad = product('Entrust SC', 'pesticide', '62719-621', Decimal('4'), 1, Decimal('420.00'), 'Qt')
        abamectin = product('Agri-Mek SC', 'pesticide', '100-1351', Decimal('12'), 7, Decimal('310.00'), 'Qt')
        copper = product('Kocide 3000', 'pesticide', '91411-4', Decimal('48'), 0, Decimal('7.80'), 'Lb')
        oil = product('415 Spray Oil', 'pesticide', '86330-2', Decimal('4'), 0, Decimal('9.20'), 'Ga')
        fert = product('CAN-17', 'fertilizer', '', None, None, Decimal('3.10'), 'Ga')

        # --- Spray history (last ~10 weeks) + one live REI --------------------
        now = timezone.now()

        def spray(field, days_ago, items, method='ground', applied_by='Ag Rx / M. Torres'):
            started = now - timedelta(days=days_ago, hours=6)
            event = ApplicationEvent.objects.filter(
                company=company, field=field, date_started=started,
            ).first()
            if event:
                return event
            event = ApplicationEvent.objects.create(
                company=company, farm=field.farm, field=field,
                date_started=started,
                treated_area_acres=field.total_acres,
                application_method=method,
                applied_by=applied_by,
                commodity_name=(field.current_crop or '').replace('_', ' ').upper(),
                pur_status='draft',
                imported_from='manual',
            )
            for idx, (prod, amount, unit, rate, rate_unit) in enumerate(items):
                TankMixItem.objects.create(
                    application_event=event, product=prod,
                    total_amount=amount, amount_unit=unit,
                    rate=rate, rate_unit=rate_unit, sort_order=idx,
                )
            event.update_compliance_from_items()
            return event

        spray(b1, 70, [(oil, Decimal('37.0'), 'Ga', Decimal('2.0'), 'Ga/A')])
        spray(b1, 42, [(abamectin, Decimal('4.6'), 'Qt', Decimal('0.25'), 'Qt/A'),
                       (oil, Decimal('18.5'), 'Ga', Decimal('1.0'), 'Ga/A')])
        spray(b2, 41, [(abamectin, Decimal('3.0'), 'Qt', Decimal('0.25'), 'Qt/A')])
        spray(b3, 21, [(copper, Decimal('39.0'), 'Lb', Decimal('4.0'), 'Lb/A')])
        spray(b4, 14, [(spinosad, Decimal('5.6'), 'Qt', Decimal('0.25'), 'Qt/A')])
        # Recent spray with a 48h REI → live countdown on the dashboard
        spray(b2, 1, [(copper, Decimal('48.0'), 'Lb', Decimal('4.0'), 'Lb/A')])

        # --- Harvests ---------------------------------------------------------
        def harvest(field, days_ago, bins, variety):
            Harvest.objects.get_or_create(
                field=field,
                harvest_date=date.today() - timedelta(days=days_ago),
                defaults={
                    'crop_variety': variety,
                    'acres_harvested': field.total_acres,
                    'total_bins': bins,
                    'phi_verified': True,
                    'status': 'completed',
                },
            )

        harvest(b1, 130, 370, 'navel_orange')
        harvest(b2, 128, 235, 'navel_orange')
        harvest(b3, 35, 180, 'eureka_lemon')

        # --- Water ------------------------------------------------------------
        well, _ = WaterSource.objects.get_or_create(
            farm=north, name='North Well #1',
            defaults={
                'source_type': 'well', 'active': True,
                'gps_latitude': Decimal('34.4485000'),
                'gps_longitude': Decimal('-119.2435000'),
            },
        )
        WaterTest.objects.get_or_create(
            water_source=well,
            test_date=date.today() - timedelta(days=45),
            defaults={
                'test_type': 'microbial',
                'lab_name': 'FGL Environmental',
                'ecoli_result': Decimal('12.00'),
                'total_coliform_result': Decimal('88.00'),
                'status': 'pass',
            },
        )

        # --- Compliance -------------------------------------------------------
        ComplianceProfile.objects.get_or_create(
            company=company,
            defaults={
                'primary_state': 'CA',
                'requires_pur_reporting': True,
                'requires_wps_compliance': True,
            },
        )
        ComplianceDeadline.objects.get_or_create(
            company=company, name='PUR Report — monthly filing',
            defaults={
                'category': 'reporting',
                'due_date': date.today() + timedelta(days=5),
                'warning_days': 7,
            },
        )
        ComplianceDeadline.objects.get_or_create(
            company=company, name='Well flowmeter calibration',
            defaults={
                'category': 'water',
                'due_date': date.today() + timedelta(days=21),
                'warning_days': 30,
            },
        )

        # --- Packinghouse & settlement (feeds Crop Reports) --------------------
        ph, _ = Packinghouse.objects.get_or_create(
            company=company, name='Ventura Pacific Packers',
            defaults={'short_code': 'VPP', 'city': 'Ventura', 'state': 'CA'},
        )
        pool, _ = Pool.objects.get_or_create(
            packinghouse=ph, pool_id='NAV-2026',
            defaults={'name': 'Navel Pool 2026', 'commodity': 'NAVELS', 'season': '2025-2026'},
        )
        PoolSettlement.objects.get_or_create(
            pool=pool, field=b1,
            statement_date=date.today() - timedelta(days=60),
            defaults={
                'total_bins': Decimal('370.00'),
                'total_credits': Decimal('14060.00'),
                'total_deductions': Decimal('2960.00'),
                'net_return': Decimal('11100.00'),
                'prior_advances': Decimal('5550.00'),
                'amount_due': Decimal('5550.00'),
            },
        )

        # --- Pick & Haul -------------------------------------------------------
        self._seed_pickhaul(company, user)

        self.stdout.write(self.style.SUCCESS(
            f"Demo data ready. Log in as {DEMO_EMAIL} / {DEMO_PASSWORD}"
        ))

    def _seed_pickhaul(self, company, owner):
        """A small but complete pick & haul season: every match method family,
        every aging bucket, an inactive receipt, unmatched charges (gate 11),
        manual picks, and a sync batch so the freshness banner has data."""
        from io import StringIO

        from django.contrib.auth import get_user_model
        from django.core.management import call_command

        from api.models import (
            CompanyMembership, LegalEntity, Packinghouse,
            PickHaulDirectCharge, PickHaulInvoice, PickHaulManualPick,
            PickHaulPull, PickHaulReceipt, PickHaulSyncBatch, Role,
        )
        from api.services.pickhaul import run_platform_gates, run_reconciliation
        from api.services.pickhaul.linking import relink_season

        # Real permission wiring, so HasPermission passes for the demo users.
        call_command('setup_roles', stdout=StringIO())

        User = get_user_model()
        accountant = User.objects.filter(email='accountant@grovemaster.com').first()
        if not accountant:
            accountant = User.objects.create_user(
                email='accountant@grovemaster.com', password='demo1234',
                first_name='Demo', last_name='Accountant',
            )
        accountant.current_company = company
        accountant.save(update_fields=['current_company'])
        CompanyMembership.objects.get_or_create(
            user=accountant, company=company,
            defaults={'role': Role.objects.get(codename='accountant'), 'is_active': True},
        )

        today = date.today()
        season = today.year

        sla, _ = Packinghouse.objects.get_or_create(
            company=company, short_code='SLA',
            defaults={'name': 'Saticoy Lemon Association', 'city': 'Santa Paula'},
        )
        lim, _ = Packinghouse.objects.get_or_create(
            company=company, short_code='LIM', defaults={'name': 'Limoneira'},
        )
        dft, _ = LegalEntity.objects.get_or_create(
            company=company, short_code='DFT', defaults={'name': 'Demo Family Trust'},
        )

        def receipt(no, days_ago, block, bins, active=True):
            return PickHaulReceipt.objects.update_or_create(
                packinghouse=sla, entity=dft, season=season, receipt_no=no,
                defaults={
                    'company': company, 'pool': f'LEM{season}', 'block_raw': block,
                    'pick_date': today - timedelta(days=days_ago),
                    'variety_code': 'L', 'commodity_code': 'LEM',
                    'uom': 'BINS', 'qty': Decimal(bins), 'bins': Decimal(bins),
                    'is_active': active,
                },
            )[0]

        for i, days_ago in enumerate((40, 38, 35, 33, 30, 28, 25, 22)):
            receipt(f'18{2600 + i}', days_ago, 'NORTH BLOCK', '20.5')
        receipt('182710', 27, 'SOUTH BLOCK', '10.0')
        receipt('182711', 26, 'NORTH BLOCK', '18.0', active=False)  # vanished from portal

        def charge(row_hash, debit, kind, ref, days_ago, block=''):
            return PickHaulDirectCharge.objects.update_or_create(
                packinghouse=sla, entity=dft, season=season, row_hash=row_hash,
                defaults={
                    'company': company, 'block_raw': block,
                    'charge_date': today - timedelta(days=days_ago),
                    'charge_desc': f'{kind}ING CHARGES', 'kind': kind,
                    'ap_reference': ref, 'debit': Decimal(debit),
                },
            )[0]

        charge('demo-c1', '12541.36', 'PICK', 'APM-SL-00500', 20)
        charge('demo-c2', '700.00', 'PICK', 'APM-SL-00600', 18)
        charge('demo-c3', '300.00', 'PICK', 'APM-SL-00600', 18)
        charge('demo-c4', '56544.00', 'PICK', 'APM-SL-00562', 15)  # nobody keyed this
        charge('demo-c5', '120.00', 'HAUL', 'APM-SL-00700', 19)

        def invoice(no, amount, kind, contractor, emailed_days_ago=None, block='',
                    frm=40, to=20, **kwargs):
            return PickHaulInvoice.objects.update_or_create(
                packinghouse=sla, entity=dft, season=season, kind=kind,
                contractor=contractor, invoice_no=no, amount=Decimal(amount),
                defaults={
                    'company': company, 'block_raw': block,
                    'date_from': today - timedelta(days=frm),
                    'date_to': today - timedelta(days=to),
                    'date_paid': today - timedelta(days=(emailed_days_ago or 15) + 2),
                    'date_emailed': (today - timedelta(days=emailed_days_ago)
                                     if emailed_days_ago else None),
                    'source': 'platform', 'created_by': owner, **kwargs,
                },
            )[0]

        invoice('89110', '12541.36', 'PICK', 'Magana', 18, block='NORTH BLOCK')  # exact
        invoice('89111', '1000.00', 'PICK', 'Magana', 15)                        # reference
        invoice('89112', '120.00', 'HAUL', 'Ortiz', 15)                          # exact haul
        # The chase list: unmatched, one per aging bucket.
        invoice('90001', '2000.00', 'PICK', 'Magana', 10)
        invoice('90002', '1500.00', 'PICK', 'MCM', 35)
        invoice('90003', '3000.00', 'PICK', 'Magana', 70)
        invoice('90004', '4000.00', 'PICK', 'Magana', 100)
        # Gate 7: $250/bin over the 10-bin SOUTH BLOCK receipt.
        invoice('90005', '2500.00', 'PICK', 'MCM', 12, block='SOUTH BLOCK', frm=28, to=26)

        sheets = [
            ('Limoneira', 'Rancho Verde', 'Block A', '210.0', '7991.71', True),
            ('Limoneira', 'Rancho Verde', 'Block A', '180.0', '7991.71', False),
            ("JPF Avo's", 'Creekside', 'Avo 2', '95.5', '5120.00', True),
            ('Piru Sun Pac', 'Sunrise', 'Block 3', '60.0', '', True),
        ]
        for row_no, (sheet, ranch, block, bins, cost, count) in enumerate(sheets, start=1):
            PickHaulManualPick.objects.update_or_create(
                company=company, packinghouse=lim, entity=dft, season=season,
                sheet=sheet, row_no=row_no,
                defaults={
                    'ranch': ranch, 'block': block, 'varietal': 'Lemon',
                    'pick_date': today - timedelta(days=30 + row_no),
                    'bins': Decimal(bins),
                    'cost': Decimal(cost) if cost else None,
                    'harvester': 'Crew 5', 'count_cost': count,
                },
            )

        batch, _ = PickHaulSyncBatch.objects.get_or_create(
            company=company, season=season, kind='push', status='applied',
            bundle_sha256='demo' * 16,
            defaults={
                'source_label': 'pickhaul-local @ DEMO-MACHINE',
                'counts': {'receipts': 10, 'direct_charges': 5, 'pulls': 1},
            },
        )
        PickHaulPull.objects.get_or_create(
            packinghouse=sla, entity=dft, season=season,
            pulled_at=timezone.now() - timedelta(hours=6), sha256='e' * 64,
            defaults={
                'company': company, 'batch': batch,
                'file_name': 'Receiving SLA DFT Spokane Data.xlsx',
                'header_year': season, 'row_count': 10,
            },
        )

        relink_season(company, season)
        run_reconciliation(company, season)
        run_platform_gates(company, season, batch=batch)
        self.stdout.write(
            '  Pick & haul demo season seeded '
            '(accountant login: accountant@grovemaster.com / demo1234)'
        )
