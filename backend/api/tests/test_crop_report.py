"""
Tests for the ranch-crop report aggregator.

Focus areas:
- Crop token matching (the fuzzy bit most likely to drift)
- Combo enumeration picks up both Field.current_crop and Harvest.crop_variety
- Revenue and spray cost aggregate from the fields we expect
- Null-field settlements attach to the right ranch-crop when the pool
  commodity matches and the farm has deliveries for the pool
- Progressive detail flags — has_block_level_data, data_gaps — behave
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from api.models import (
    ApplicationEvent,
    Company,
    Farm,
    Field,
    Harvest,
    Packinghouse,
    Pool,
    PoolSettlement,
    PackinghouseDelivery,
    PesticideApplication,
    PesticideProduct,
    Product,
    TankMixItem,
)
from api.services.crop_report import (
    _crops_match,
    _normalize_tokens,
    _enumerate_ranch_crop_combos,
    build_crop_report_card,
    generate_ranch_crop_cards,
)


class CropTokenTests(TestCase):
    def test_plurals_collapse(self):
        self.assertTrue(_crops_match('navel_orange', 'NAVELS'))
        self.assertTrue(_crops_match('lemon', 'LEMONS'))
        self.assertTrue(_crops_match('hass_avocado', 'AVOCADOS'))

    def test_unrelated_crops_dont_match(self):
        self.assertFalse(_crops_match('navel_orange', 'HASS AVOCADO'))
        self.assertFalse(_crops_match('lemon', 'GRAPEFRUIT'))

    def test_empty_or_none_is_safe(self):
        self.assertFalse(_crops_match(None, 'NAVELS'))
        self.assertFalse(_crops_match('', 'NAVELS'))
        self.assertFalse(_crops_match('navel_orange', ''))
        self.assertEqual(_normalize_tokens(None), set())


class RanchCropAggregationBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Finch Farms')
        cls.farm = Farm.objects.create(
            company=cls.company, name='North Ranch',
            gps_latitude=Decimal('34.20'), gps_longitude=Decimal('-119.10'),
        )
        cls.other_farm = Farm.objects.create(
            company=cls.company, name='South Ranch',
        )
        cls.navel_field = Field.objects.create(
            farm=cls.farm, name='Block 1',
            total_acres=Decimal('20.00'),
            current_crop='navel_orange',
        )
        cls.navel_field_2 = Field.objects.create(
            farm=cls.farm, name='Block 2',
            total_acres=Decimal('15.00'),
            current_crop='navel_orange',
        )
        cls.valencia_field = Field.objects.create(
            farm=cls.farm, name='Block 3',
            total_acres=Decimal('10.00'),
            current_crop='valencia_orange',
        )
        # Other farm field — should never cross-contaminate
        cls.other_field = Field.objects.create(
            farm=cls.other_farm, name='South Block',
            total_acres=Decimal('8.00'),
            current_crop='hass_avocado',
        )


class ComboEnumerationTests(RanchCropAggregationBase):
    def test_enumerate_picks_up_field_current_crop(self):
        combos = _enumerate_ranch_crop_combos(self.company)
        self.assertIn((self.farm.id, 'navel_orange'), combos)
        self.assertIn((self.farm.id, 'valencia_orange'), combos)
        self.assertIn((self.other_farm.id, 'hass_avocado'), combos)

    def test_enumerate_picks_up_harvest_variety_even_if_field_changed(self):
        # Replant scenario — field says Valencia now, but it has a Navel
        # harvest record from last season.
        Harvest.objects.create(
            field=self.valencia_field,
            harvest_date=date(2026, 3, 1),
            crop_variety='navel_orange',  # historical harvest
            acres_harvested=Decimal('10.00'),
            total_bins=100,
        )
        combos = _enumerate_ranch_crop_combos(self.company)
        # Both the current Valencia assignment AND the historical Navel
        # harvest should surface
        self.assertIn((self.farm.id, 'valencia_orange'), combos)
        self.assertIn((self.farm.id, 'navel_orange'), combos)


class CardAggregationTests(RanchCropAggregationBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        # A pesticide product with cost that lines up with the application unit
        cls.product = PesticideProduct.objects.create(
            epa_registration_number='100-1', product_name='SomeSpray',
            cost_per_unit=Decimal('50.00'), cost_unit='gal',
        )

    def _application(self, field, dt=date(2026, 3, 1),
                     amount_used=Decimal('4.00'), acres=Decimal('5.00')):
        return PesticideApplication.objects.create(
            field=field, product=self.product,
            application_date=dt,
            start_time=time(8, 0), end_time=time(10, 0),
            acres_treated=acres, amount_used=amount_used,
            unit_of_measure='gal', application_method='Ground Spray',
            applicator_name='Tester',
        )

    def test_spray_cost_aggregates_across_fields_in_same_ranch_crop(self):
        self._application(self.navel_field, amount_used=Decimal('4.00'))   # $200
        self._application(self.navel_field_2, amount_used=Decimal('2.00')) # $100
        # Different crop on same farm — should NOT contribute
        self._application(self.valencia_field, amount_used=Decimal('10.00'))  # $500

        card = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        self.assertEqual(card.total_spray_cost, 300.0)
        self.assertEqual(card.field_count, 2)

    def test_bins_aggregate_from_both_blocks(self):
        Harvest.objects.create(
            field=self.navel_field, harvest_date=date(2026, 2, 10),
            crop_variety='navel_orange',
            acres_harvested=Decimal('20.00'), total_bins=400,
        )
        Harvest.objects.create(
            field=self.navel_field_2, harvest_date=date(2026, 3, 1),
            crop_variety='navel_orange',
            acres_harvested=Decimal('15.00'), total_bins=300,
        )
        card = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        self.assertEqual(card.total_bins, 700)
        self.assertEqual(card.total_acres, 35.0)

    def test_field_linked_settlement_counted_in_revenue(self):
        ph = Packinghouse.objects.create(
            company=self.company, name='VPOA', short_code='VPOA',
        )
        pool = Pool.objects.create(
            packinghouse=ph, pool_id='POOL-1', name='Navel Pool',
            commodity='NAVELS', season='2025-2026',
        )
        PoolSettlement.objects.create(
            pool=pool, field=self.navel_field,
            statement_date=date(2026, 3, 15),
            total_bins=Decimal('400'),
            total_credits=Decimal('12000'),
            total_deductions=Decimal('2000'),
            net_return=Decimal('10000'),
            amount_due=Decimal('10000'),
            net_per_bin=Decimal('25.00'),
        )
        card = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        self.assertEqual(card.total_revenue, 10000.0)
        self.assertEqual(card.applicable_settlements, 1)

    def test_null_field_settlement_attaches_when_pool_has_delivery(self):
        ph = Packinghouse.objects.create(
            company=self.company, name='VPOA', short_code='VPOA',
        )
        pool = Pool.objects.create(
            packinghouse=ph, pool_id='POOL-2', name='Navel Pool',
            commodity='NAVELS', season='2025-2026',
        )
        # Delivery from our farm ties the pool to us
        PackinghouseDelivery.objects.create(
            pool=pool, field=self.navel_field,
            ticket_number='TKT-1', delivery_date=date(2026, 2, 5),
            bins=Decimal('400'),
        )
        # Settlement at the grower level, no field specified
        PoolSettlement.objects.create(
            pool=pool, field=None,
            statement_date=date(2026, 3, 20),
            total_bins=Decimal('400'),
            total_credits=Decimal('12000'),
            total_deductions=Decimal('2000'),
            net_return=Decimal('10000'),
            amount_due=Decimal('10000'),
            net_per_bin=Decimal('25.00'),
        )
        card = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        # Null-field settlement should be picked up via delivery linkage
        self.assertEqual(card.total_revenue, 10000.0)
        self.assertEqual(card.applicable_settlements, 1)

    def test_ranch_level_application_attaches_by_commodity(self):
        # New ApplicationEvent attached to farm, no field — matches by commodity
        product = Product.objects.create(
            product_name='SomeSpray2', product_type='pesticide',
            cost_per_unit=Decimal('50.00'), cost_unit='Ga',
        )
        event = ApplicationEvent.objects.create(
            company=self.company, farm=self.farm, field=None,
            date_started=timezone.make_aware(datetime(2026, 3, 1, 8, 0)),
            treated_area_acres=Decimal('20.00'),
            application_method='ground',
            commodity_name='NAVELS',
        )
        TankMixItem.objects.create(
            application_event=event, product=product,
            total_amount=Decimal('3.00'), amount_unit='Ga',
            rate=Decimal('0.15'), rate_unit='Ga/A',
        )
        card = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        # 3 gal * $50 = $150
        self.assertEqual(card.total_spray_cost, 150.0)
        self.assertEqual(card.applicable_events, 1)

    def test_card_flags_block_level_data_when_multiple_fields(self):
        card = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        self.assertTrue(card.has_block_level_data)

    def test_card_lists_data_gaps_when_no_harvest_or_settlement(self):
        card = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        gap_text = ' '.join(card.data_gaps).lower()
        self.assertIn('no harvests', gap_text)
        self.assertIn('no pool settlements', gap_text)

    def test_cross_farm_data_is_not_commingled(self):
        # Navel activity on South Ranch shouldn't contaminate the North
        # Ranch navel card
        navel_at_south = Field.objects.create(
            farm=self.other_farm, name='South Block 2',
            total_acres=Decimal('12.00'),
            current_crop='navel_orange',
        )
        self._application(navel_at_south, amount_used=Decimal('6.00'))  # $300 on south
        self._application(self.navel_field, amount_used=Decimal('4.00')) # $200 on north

        card_north = build_crop_report_card(
            company=self.company, farm_id=self.farm.id,
            crop_variety='navel_orange',
            season_start=date(2025, 10, 1),
            season_end=date(2026, 9, 30),
            season_label='2025-2026',
        )
        self.assertEqual(card_north.total_spray_cost, 200.0)


class GenerateAllCardsTests(RanchCropAggregationBase):
    def test_generator_returns_cards_sorted_by_revenue(self):
        ph = Packinghouse.objects.create(
            company=self.company, name='VPOA', short_code='VPOA',
        )
        pool1 = Pool.objects.create(
            packinghouse=ph, pool_id='P1', name='Navel', commodity='NAVELS',
            season='2025-2026',
        )
        pool2 = Pool.objects.create(
            packinghouse=ph, pool_id='P2', name='Valencia', commodity='VALENCIAS',
            season='2025-2026',
        )
        # Navel pulls $10k, Valencia $2k — Navel should sort first
        PoolSettlement.objects.create(
            pool=pool1, field=self.navel_field,
            statement_date=date(2026, 3, 1),
            total_bins=Decimal('400'),
            total_credits=Decimal('12000'),
            total_deductions=Decimal('2000'),
            net_return=Decimal('10000'),
            amount_due=Decimal('10000'),
        )
        PoolSettlement.objects.create(
            pool=pool2, field=self.valencia_field,
            statement_date=date(2026, 3, 1),
            total_bins=Decimal('80'),
            total_credits=Decimal('2400'),
            total_deductions=Decimal('400'),
            net_return=Decimal('2000'),
            amount_due=Decimal('2000'),
        )
        cards = generate_ranch_crop_cards(company=self.company)
        self.assertTrue(len(cards) >= 2)
        # Highest revenue first
        self.assertGreaterEqual(cards[0].total_revenue, cards[1].total_revenue)
