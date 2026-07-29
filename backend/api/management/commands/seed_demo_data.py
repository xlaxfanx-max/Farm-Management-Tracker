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

        self.stdout.write(self.style.SUCCESS(
            f"Demo data ready. Log in as {DEMO_EMAIL} / {DEMO_PASSWORD}"
        ))
