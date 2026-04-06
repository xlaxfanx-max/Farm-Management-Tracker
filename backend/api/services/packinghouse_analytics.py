"""
Packinghouse Analytics Service
==============================
Business logic for packinghouse analytics and reporting endpoints.
Keeps views thin: they extract request params and call these static methods.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import (
    Avg, Count, Max, Q, Sum, DecimalField,
)
from django.db.models.functions import Coalesce

from api.models import (
    Harvest, Packinghouse, PackinghouseDelivery, PackoutGradeLine,
    PackoutReport, Pool, PoolSettlement, SettlementDeduction,
    SettlementGradeLine,
)
from api.services.season_service import (
    SeasonService, get_citrus_season, get_crop_category_for_commodity,
    get_primary_unit_for_commodity, get_varieties_for_commodity,
    parse_legacy_season, parse_season_for_category,
)


class PackinghouseAnalyticsService:
    """Pure business-logic helpers for packinghouse analytics endpoints."""

    # -----------------------------------------------------------------
    # profitability_analysis
    # -----------------------------------------------------------------
    @staticmethod
    def profitability_analysis(company, season_id=None, field_id=None, packinghouse_id=None):
        # Get available seasons (only those with settlement data)
        seasons_with_settlements = PoolSettlement.objects.filter(
            pool__packinghouse__company=company,
            field__isnull=True
        ).values_list('pool__season', flat=True).distinct()
        seasons_with_settlements = set(seasons_with_settlements)

        # Get all seasons from pools
        all_seasons = Pool.objects.filter(
            packinghouse__company=company
        ).values_list('season', flat=True).distinct().order_by('-season')
        available_seasons = list(all_seasons)

        # Get current/default season
        today = date.today()
        current_season = get_citrus_season(today)
        default_season = current_season.label

        selected_season = season_id or ''

        # If no season specified or empty, prefer seasons with settlement data
        if not selected_season:
            for season in available_seasons:
                if season in seasons_with_settlements:
                    selected_season = season
                    break
            if not selected_season:
                selected_season = default_season

        # If selected season not in available seasons and we have data
        if selected_season not in available_seasons and available_seasons:
            for season in available_seasons:
                if season in seasons_with_settlements:
                    selected_season = season
                    break
            if selected_season not in available_seasons:
                selected_season = available_seasons[0]

        # Calculate season date range for harvest filtering
        try:
            season_start, season_end = parse_legacy_season(selected_season)
        except (ValueError, IndexError):
            season_start = current_season.start_date
            season_end = current_season.end_date

        # ---- STEP 1: pools with settlements ----
        pool_filters = Q(packinghouse__company=company, season=selected_season)
        if packinghouse_id:
            pool_filters &= Q(packinghouse_id=packinghouse_id)

        pools = Pool.objects.filter(pool_filters).select_related('packinghouse')

        pool_ids = list(pools.values_list('id', flat=True))
        grower_settlements = PoolSettlement.objects.filter(
            pool_id__in=pool_ids, field__isnull=True
        ).select_related('pool')
        settlement_by_pool = {}
        for settlement in grower_settlements:
            if settlement.pool_id not in settlement_by_pool:
                settlement_by_pool[settlement.pool_id] = settlement

        pool_settlement_data = {}
        for pool in pools:
            settlement = settlement_by_pool.get(pool.id)
            if settlement:
                pool_settlement_data[pool.id] = {
                    'pool': pool,
                    'total_bins': settlement.total_bins or Decimal('0'),
                    'total_credits': settlement.total_credits or Decimal('0'),
                    'total_deductions': settlement.total_deductions or Decimal('0'),
                    'net_return': settlement.net_return or Decimal('0'),
                    'net_per_bin': settlement.net_per_bin or Decimal('0'),
                }

        # ---- STEP 2: deliveries grouped by field and pool ----
        delivery_filters = Q(
            pool__packinghouse__company=company,
            pool__season=selected_season
        )
        if packinghouse_id:
            delivery_filters &= Q(pool__packinghouse_id=packinghouse_id)
        if field_id:
            delivery_filters &= Q(field_id=field_id)

        deliveries = PackinghouseDelivery.objects.filter(
            delivery_filters
        ).select_related('field', 'field__farm', 'pool', 'pool__packinghouse')

        field_deliveries = defaultdict(lambda: {
            'field': None,
            'bins_delivered': Decimal('0'),
            'delivery_count': 0,
            'pools': set(),
            'pool_bins': defaultdict(lambda: Decimal('0')),
        })

        for delivery in deliveries:
            if delivery.field:
                fd = field_deliveries[delivery.field_id]
                fd['field'] = delivery.field
                fd['bins_delivered'] += delivery.bins or Decimal('0')
                fd['delivery_count'] += 1
                fd['pools'].add(delivery.pool_id)
                fd['pool_bins'][delivery.pool_id] += delivery.bins or Decimal('0')

        # ---- STEP 3: profitability per field ----
        results = []
        totals = {
            'total_bins': Decimal('0'),
            'gross_revenue': Decimal('0'),
            'total_deductions': Decimal('0'),
            'net_settlement': Decimal('0'),
        }

        for field_id_key, fd in field_deliveries.items():
            field = fd['field']
            if not field:
                continue

            bins_delivered = fd['bins_delivered']
            if bins_delivered <= 0:
                continue

            allocated_credits = Decimal('0')
            allocated_deductions = Decimal('0')
            allocated_net = Decimal('0')
            packinghouse_names = set()
            pool_names = set()

            for pool_id in fd['pools']:
                if pool_id in pool_settlement_data:
                    psd = pool_settlement_data[pool_id]
                    pool_total_bins = psd['total_bins']

                    if pool_total_bins > 0:
                        field_pool_bins = fd['pool_bins'][pool_id]
                        share_ratio = field_pool_bins / pool_total_bins

                        allocated_credits += psd['total_credits'] * share_ratio
                        allocated_deductions += psd['total_deductions'] * share_ratio
                        allocated_net += psd['net_return'] * share_ratio

                    packinghouse_names.add(psd['pool'].packinghouse.name)
                    pool_names.add(psd['pool'].name)

            gross_per_bin = (allocated_credits / bins_delivered) if bins_delivered > 0 else Decimal('0')
            deductions_per_bin = (allocated_deductions / bins_delivered) if bins_delivered > 0 else Decimal('0')
            net_per_bin = (allocated_net / bins_delivered) if bins_delivered > 0 else Decimal('0')
            margin_percent = round((float(allocated_net) / float(allocated_credits) * 100), 1) if allocated_credits > 0 else 0

            field_data = {
                'field_id': field.id,
                'field_name': field.name,
                'farm_id': field.farm.id if field.farm else None,
                'farm_name': field.farm.name if field.farm else '',
                'packinghouse_name': ', '.join(packinghouse_names) if packinghouse_names else '',
                'pool_name': ', '.join(pool_names) if pool_names else '',
                'total_bins': float(bins_delivered),
                'bins_delivered': float(bins_delivered),
                'delivery_count': fd['delivery_count'],
                'gross_revenue': float(allocated_credits),
                'total_deductions': float(allocated_deductions),
                'net_settlement': float(allocated_net),
                'gross_per_bin': round(float(gross_per_bin), 2),
                'deductions_per_bin': round(float(deductions_per_bin), 2),
                'net_per_bin': round(float(net_per_bin), 2),
                'return_margin': margin_percent,
            }

            results.append(field_data)

            totals['total_bins'] += bins_delivered
            totals['gross_revenue'] += allocated_credits
            totals['total_deductions'] += allocated_deductions
            totals['net_settlement'] += allocated_net

        results.sort(key=lambda x: x['net_settlement'], reverse=True)

        # ---- STEP 4: pool-level fallback ----
        pool_results = []
        if not results and pool_settlement_data:
            for pool_id, psd in pool_settlement_data.items():
                pool = psd['pool']
                pool_bins = psd['total_bins']
                pool_gross = psd['total_credits']
                pool_deductions = psd['total_deductions']
                pool_net = psd['net_return']
                margin_percent = round((float(pool_net) / float(pool_gross) * 100), 1) if pool_gross > 0 else 0

                pool_results.append({
                    'pool_id': pool.id,
                    'pool_name': pool.name,
                    'packinghouse_name': pool.packinghouse.name,
                    'commodity': pool.commodity,
                    'total_bins': float(pool_bins),
                    'gross_revenue': float(pool_gross),
                    'total_deductions': float(pool_deductions),
                    'net_settlement': float(pool_net),
                    'gross_per_bin': round(float(pool_gross / pool_bins), 2) if pool_bins > 0 else 0,
                    'deductions_per_bin': round(float(pool_deductions / pool_bins), 2) if pool_bins > 0 else 0,
                    'net_per_bin': float(psd['net_per_bin']),
                    'return_margin': margin_percent,
                })

                totals['total_bins'] += pool_bins
                totals['gross_revenue'] += pool_gross
                totals['total_deductions'] += pool_deductions
                totals['net_settlement'] += pool_net

        return_margin = round((float(totals['net_settlement']) / float(totals['gross_revenue']) * 100), 1) if totals['gross_revenue'] > 0 else 0

        pool_commodities = set(p.commodity for p in pools if p.commodity)
        if len(pool_commodities) == 1:
            unit_info = get_primary_unit_for_commodity(pool_commodities.pop())
        else:
            unit_info = get_primary_unit_for_commodity('CITRUS')

        summary = {
            'total_fields': len(results),
            'total_pools': len(pool_results),
            'total_bins': float(totals['total_bins']),
            'gross_revenue': float(totals['gross_revenue']),
            'total_deductions': float(totals['total_deductions']),
            'net_settlement': float(totals['net_settlement']),
            'avg_net_per_bin': round(float(totals['net_settlement'] / totals['total_bins']), 2) if totals['total_bins'] > 0 else 0,
            'return_margin': return_margin,
            'primary_unit': unit_info['unit'],
            'primary_unit_label': unit_info['label_plural'],
        }

        data_level = 'field' if results else ('pool' if pool_results else 'none')

        return {
            'season': selected_season,
            'available_seasons': available_seasons,
            'data_level': data_level,
            'summary': summary,
            'by_field': results,
            'by_pool': pool_results,
            'message': 'Showing pool-level data. Add delivery records to see field-level profitability.' if data_level == 'pool' else None,
        }

    # -----------------------------------------------------------------
    # deduction_breakdown
    # -----------------------------------------------------------------
    @staticmethod
    def deduction_breakdown(company, season_id=None, field_id=None, packinghouse_id=None):
        # Get seasons with settlement data
        seasons_with_settlements = PoolSettlement.objects.filter(
            pool__packinghouse__company=company
        ).values_list('pool__season', flat=True).distinct()
        seasons_with_settlements = list(set(seasons_with_settlements))
        seasons_with_settlements.sort(reverse=True)

        today = date.today()
        current_season = get_citrus_season(today)
        default_season = current_season.label

        selected_season = season_id or ''
        if not selected_season:
            if seasons_with_settlements:
                selected_season = seasons_with_settlements[0]
            else:
                selected_season = default_season

        # Build settlement filter
        settlement_filters = Q(
            pool__packinghouse__company=company,
            pool__season=selected_season
        )
        if packinghouse_id:
            settlement_filters &= Q(pool__packinghouse_id=packinghouse_id)
        if field_id:
            settlement_filters &= Q(field_id=field_id)

        settlements = PoolSettlement.objects.filter(settlement_filters)
        settlement_ids = settlements.values_list('id', flat=True)

        total_bins = settlements.aggregate(
            total=Coalesce(Sum('total_bins'), Decimal('0'))
        )['total']

        deductions = SettlementDeduction.objects.filter(settlement_id__in=settlement_ids)

        category_totals = defaultdict(lambda: {
            'total_amount': Decimal('0'),
            'items': defaultdict(lambda: {'amount': Decimal('0'), 'count': 0})
        })

        for ded in deductions:
            category = ded.category
            description = ded.description
            amount = ded.amount or Decimal('0')
            category_totals[category]['total_amount'] += amount
            category_totals[category]['items'][description]['amount'] += amount
            category_totals[category]['items'][description]['count'] += 1

        by_category = []
        grand_total = Decimal('0')

        category_order = ['packing', 'assessment', 'pick_haul', 'capital', 'marketing', 'other']
        category_labels = {
            'packing': 'Packing Charges',
            'assessment': 'Assessments',
            'pick_haul': 'Pick & Haul',
            'capital': 'Capital Funds',
            'marketing': 'Marketing',
            'other': 'Other',
        }

        for category in category_order:
            if category in category_totals:
                cat_data = category_totals[category]
                cat_total = cat_data['total_amount']
                grand_total += cat_total

                items = []
                for desc, item_data in cat_data['items'].items():
                    items.append({
                        'description': desc,
                        'amount': float(item_data['amount']),
                        'per_bin': round(float(item_data['amount'] / total_bins), 4) if total_bins > 0 else 0,
                        'count': item_data['count'],
                    })
                items.sort(key=lambda x: x['amount'], reverse=True)

                by_category.append({
                    'category': category,
                    'label': category_labels.get(category, category),
                    'total_amount': float(cat_total),
                    'per_bin': round(float(cat_total / total_bins), 2) if total_bins > 0 else 0,
                    'percent_of_total': round((float(cat_total) / float(grand_total) * 100), 1) if grand_total > 0 else 0,
                    'items': items,
                })

        # Recalculate percent_of_total
        for cat in by_category:
            if grand_total > 0:
                cat['percent_of_total'] = round((cat['total_amount'] / float(grand_total) * 100), 1)

        pool_commodities = set(
            settlements.values_list('pool__commodity', flat=True).distinct()
        )
        pool_commodities.discard(None)
        if len(pool_commodities) == 1:
            ded_unit_info = get_primary_unit_for_commodity(pool_commodities.pop())
        else:
            ded_unit_info = get_primary_unit_for_commodity('CITRUS')

        return {
            'season': selected_season,
            'total_bins': float(total_bins),
            'grand_total': float(grand_total),
            'grand_total_per_bin': round(float(grand_total / total_bins), 2) if total_bins > 0 else 0,
            'by_category': by_category,
            'primary_unit': ded_unit_info['unit'],
            'primary_unit_label': ded_unit_info['label_plural'],
        }

    # -----------------------------------------------------------------
    # season_comparison
    # -----------------------------------------------------------------
    @staticmethod
    def season_comparison(company, field_id=None, packinghouse_id=None):
        available_seasons = Pool.objects.filter(
            packinghouse__company=company
        ).values_list('season', flat=True).distinct().order_by('-season')
        available_seasons = list(available_seasons)

        results = []

        for season in available_seasons:
            settlement_filters = Q(
                pool__packinghouse__company=company,
                pool__season=season
            )
            if packinghouse_id:
                settlement_filters &= Q(pool__packinghouse_id=packinghouse_id)
            if field_id:
                settlement_filters &= Q(field_id=field_id)

            settlements = PoolSettlement.objects.filter(settlement_filters)
            settlement_agg = settlements.aggregate(
                total_bins=Coalesce(Sum('total_bins'), Decimal('0')),
                gross_revenue=Coalesce(Sum('total_credits'), Decimal('0')),
                total_deductions=Coalesce(Sum('total_deductions'), Decimal('0')),
                net_settlement=Coalesce(Sum('net_return'), Decimal('0')),
            )

            total_bins = settlement_agg['total_bins'] or Decimal('0')
            gross_revenue = settlement_agg['gross_revenue'] or Decimal('0')
            total_deductions = settlement_agg['total_deductions'] or Decimal('0')
            net_settlement = settlement_agg['net_settlement'] or Decimal('0')

            if total_bins > 0:
                return_margin = round((float(net_settlement) / float(gross_revenue) * 100), 1) if gross_revenue > 0 else 0

                results.append({
                    'season': season,
                    'total_bins': float(total_bins),
                    'gross_revenue': float(gross_revenue),
                    'total_deductions': float(total_deductions),
                    'net_settlement': float(net_settlement),
                    'gross_per_bin': round(float(gross_revenue / total_bins), 2),
                    'deductions_per_bin': round(float(total_deductions / total_bins), 2),
                    'net_per_bin': round(float(net_settlement / total_bins), 2),
                    'return_margin': return_margin,
                })

        # Year-over-year changes
        for i in range(len(results) - 1):
            current = results[i]
            previous = results[i + 1]

            if previous['net_per_bin'] != 0:
                current['net_per_bin_change'] = round(
                    ((current['net_per_bin'] - previous['net_per_bin']) / abs(previous['net_per_bin'])) * 100, 1
                )
            else:
                current['net_per_bin_change'] = None

            if previous['total_bins'] != 0:
                current['volume_change'] = round(
                    ((current['total_bins'] - previous['total_bins']) / previous['total_bins']) * 100, 1
                )
            else:
                current['volume_change'] = None

        return {'seasons': results}

    # -----------------------------------------------------------------
    # block_performance
    # -----------------------------------------------------------------
    @staticmethod
    def block_performance(company, season=None, packinghouse_id=None, commodity=None):
        filters = Q(pool__packinghouse__company=company)
        if season:
            filters &= Q(pool__season=season)
        if packinghouse_id:
            filters &= Q(pool__packinghouse_id=packinghouse_id)
        if commodity:
            filters &= Q(pool__commodity__icontains=commodity)

        latest_reports = PackoutReport.objects.filter(
            filters
        ).values('field').annotate(latest_date=Max('report_date'))

        report_filter = Q()
        for item in latest_reports:
            report_filter |= Q(field_id=item['field'], report_date=item['latest_date'])

        reports = []
        if report_filter:
            reports = list(
                PackoutReport.objects.filter(report_filter)
                .select_related('field', 'pool')
                .order_by('field_id')
            )

        pool_field_pairs = [(r.pool_id, r.field_id) for r in reports]
        settlement_lookup = {}
        if pool_field_pairs:
            settlement_filter = Q()
            for pool_id, field_id in pool_field_pairs:
                settlement_filter |= Q(pool_id=pool_id, field_id=field_id)
            for s in PoolSettlement.objects.filter(settlement_filter).order_by('pool_id', 'field_id', '-statement_date'):
                key = (s.pool_id, s.field_id)
                if key not in settlement_lookup:
                    settlement_lookup[key] = s

        results = []
        for report in reports:
            settlement = settlement_lookup.get((report.pool_id, report.field_id))

            pack_variance = None
            if report.total_packed_percent and report.house_avg_packed_percent:
                pack_variance = float(report.total_packed_percent - report.house_avg_packed_percent)

            return_variance = None
            net_per_bin = None
            house_avg_per_bin = None
            if settlement:
                net_per_bin = settlement.net_per_bin
                house_avg_per_bin = settlement.house_avg_per_bin
                if net_per_bin and house_avg_per_bin:
                    return_variance = float(net_per_bin - house_avg_per_bin)

            results.append({
                'field_id': report.field.id,
                'field_name': report.field.name,
                'pool_name': report.pool.name,
                'total_bins': report.bins_cumulative,
                'pack_percent': report.total_packed_percent,
                'house_avg_pack_percent': report.house_avg_packed_percent,
                'pack_variance': pack_variance,
                'net_per_bin': net_per_bin,
                'house_avg_per_bin': house_avg_per_bin,
                'return_variance': return_variance,
            })

        return results

    # -----------------------------------------------------------------
    # packout_trends
    # -----------------------------------------------------------------
    @staticmethod
    def packout_trends(company, field_id=None, pool_id=None, start_date=None, end_date=None):
        queryset = PackoutReport.objects.filter(
            pool__packinghouse__company=company
        ).select_related('field', 'pool')

        if field_id:
            queryset = queryset.filter(field_id=field_id)
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)
        if start_date:
            queryset = queryset.filter(report_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(report_date__lte=end_date)

        queryset = queryset.order_by('report_date')

        results = []
        for report in queryset:
            results.append({
                'report_date': report.report_date,
                'field_name': report.field.name,
                'total_packed_percent': report.total_packed_percent,
                'house_avg_packed_percent': report.house_avg_packed_percent,
            })

        return results

    # -----------------------------------------------------------------
    # settlement_comparison
    # -----------------------------------------------------------------
    @staticmethod
    def settlement_comparison(company, season, commodity=None):
        filters = Q(
            pool__packinghouse__company=company,
            pool__season=season,
            field__isnull=True
        )
        if commodity:
            filters &= Q(pool__commodity__icontains=commodity)

        settlements = PoolSettlement.objects.filter(
            filters
        ).select_related('pool', 'pool__packinghouse')

        results = []
        for settlement in settlements:
            results.append({
                'packinghouse_id': settlement.pool.packinghouse.id,
                'packinghouse_name': settlement.pool.packinghouse.name,
                'season': settlement.pool.season,
                'commodity': settlement.pool.commodity,
                'total_bins': settlement.total_bins,
                'net_return': settlement.net_return,
                'net_per_bin': settlement.net_per_bin,
                'fresh_fruit_percent': settlement.fresh_fruit_percent,
            })

        return results

    # -----------------------------------------------------------------
    # size_distribution
    # -----------------------------------------------------------------
    @staticmethod
    def size_distribution(company, season=None, packinghouse_id=None, commodity=None, group_by='farm'):
        filters = Q(pool__packinghouse__company=company)
        if season:
            filters &= Q(pool__season=season)
        if packinghouse_id:
            filters &= Q(pool__packinghouse_id=packinghouse_id)
        if commodity:
            filters &= Q(pool__commodity__icontains=commodity)

        # Latest packout report per field (with field)
        latest_with_field = PackoutReport.objects.filter(
            filters, field__isnull=False
        ).values('field').annotate(latest_date=Max('report_date'))

        # Latest packout report per pool (no field)
        latest_without_field = PackoutReport.objects.filter(
            filters, field__isnull=True
        ).values('pool').annotate(latest_date=Max('report_date'))

        groups = defaultdict(lambda: {'total_quantity': Decimal('0'), 'sizes': defaultdict(lambda: {
            'quantity': Decimal('0'),
            'percent_sum': Decimal('0'),
            'house_avg_sum': Decimal('0'),
            'count': 0,
            'house_avg_count': 0,
        })})
        all_sizes = set()

        def process_report(report, prefetched_lines):
            lines = [gl for gl in prefetched_lines if gl.packout_report_id == report.id and gl.size]
            if not lines:
                return

            if report.field:
                if group_by == 'farm' and report.field.farm:
                    gid = report.field.farm_id
                    gname = report.field.farm.name
                else:
                    gid = report.field.id
                    gname = report.field.name
            else:
                gid = f'pool_{report.pool_id}'
                gname = report.pool.name if report.pool else 'Unassigned'

            for line in lines:
                qty = line.quantity_cumulative if line.quantity_cumulative is not None else line.quantity_this_period
                pct = line.percent_cumulative if line.percent_cumulative is not None else line.percent_this_period

                all_sizes.add(line.size)
                size_data = groups[gid]['sizes'][line.size]
                size_data['quantity'] += qty
                size_data['percent_sum'] += pct
                size_data['count'] += 1
                if line.house_avg_percent is not None:
                    size_data['house_avg_sum'] += line.house_avg_percent
                    size_data['house_avg_count'] += 1

                groups[gid]['total_quantity'] += qty
                groups[gid]['group_id'] = gid if isinstance(gid, int) else 0
                groups[gid]['group_name'] = gname

        # Batch-fetch reports
        field_report_filter = Q()
        for item in latest_with_field:
            field_report_filter |= Q(field_id=item['field'], report_date=item['latest_date'])

        pool_report_filter = Q()
        for item in latest_without_field:
            pool_report_filter |= Q(pool_id=item['pool'], field__isnull=True, report_date=item['latest_date'])

        field_reports = list(
            PackoutReport.objects.filter(field_report_filter)
            .select_related('field__farm', 'pool')
        ) if field_report_filter else []

        pool_reports = list(
            PackoutReport.objects.filter(pool_report_filter)
            .select_related('pool')
        ) if pool_report_filter else []

        all_reports = field_reports + pool_reports

        report_ids = [r.id for r in all_reports]
        all_grade_lines = list(
            PackoutGradeLine.objects.filter(packout_report_id__in=report_ids).exclude(size='')
        ) if report_ids else []

        for report in all_reports:
            process_report(report, all_grade_lines)

        # Build response
        results = []
        for group_key, group_data in groups.items():
            total_qty = group_data['total_quantity']
            sizes = []
            for size_code, size_data in sorted(group_data['sizes'].items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999):
                pct = (size_data['quantity'] / total_qty * 100) if total_qty else Decimal('0')
                house_avg = None
                if size_data['house_avg_count'] > 0:
                    house_avg = size_data['house_avg_sum'] / size_data['house_avg_count']
                sizes.append({
                    'size': size_code,
                    'quantity': size_data['quantity'],
                    'percent': round(pct, 2),
                    'house_avg_percent': round(house_avg, 2) if house_avg is not None else None,
                })
            results.append({
                'group_id': group_data['group_id'],
                'group_name': group_data['group_name'],
                'total_quantity': total_qty,
                'sizes': sizes,
            })

        results.sort(key=lambda x: x['group_name'])
        sorted_sizes = sorted(all_sizes, key=lambda x: int(x) if x.isdigit() else 999)

        return {'groups': results, 'all_sizes': sorted_sizes}

    # -----------------------------------------------------------------
    # size_pricing
    # -----------------------------------------------------------------
    @staticmethod
    def size_pricing(company, season=None, packinghouse_id=None, commodity=None, group_by='none'):
        filters = Q(settlement__pool__packinghouse__company=company)
        if season:
            filters &= Q(settlement__pool__season=season)
        if packinghouse_id:
            filters &= Q(settlement__pool__packinghouse_id=packinghouse_id)
        if commodity:
            filters &= Q(settlement__pool__commodity__icontains=commodity)

        grade_lines = SettlementGradeLine.objects.filter(
            filters
        ).exclude(size='').select_related(
            'settlement__field__farm',
            'settlement__pool'
        )

        size_totals = defaultdict(lambda: {
            'total_quantity': Decimal('0'),
            'total_revenue': Decimal('0'),
            'by_farm': defaultdict(lambda: {
                'farm_name': '',
                'quantity': Decimal('0'),
                'revenue': Decimal('0'),
            }),
        })

        grand_total_qty = Decimal('0')
        grand_total_rev = Decimal('0')

        for line in grade_lines:
            s = size_totals[line.size]
            s['total_quantity'] += line.quantity
            s['total_revenue'] += line.total_amount
            grand_total_qty += line.quantity
            grand_total_rev += line.total_amount

            if group_by in ('farm', 'field') and line.settlement.field:
                if group_by == 'farm':
                    key = line.settlement.field.farm_id
                    name = line.settlement.field.farm.name
                else:
                    key = line.settlement.field.id
                    name = line.settlement.field.name
                farm_data = s['by_farm'][key]
                farm_data['farm_name'] = name
                farm_data['quantity'] += line.quantity
                farm_data['revenue'] += line.total_amount

        results = []
        for size_code in sorted(size_totals.keys(), key=lambda x: int(x) if x.isdigit() else 999):
            s = size_totals[size_code]
            weighted_avg_fob = (s['total_revenue'] / s['total_quantity']) if s['total_quantity'] else None
            pct_qty = (s['total_quantity'] / grand_total_qty * 100) if grand_total_qty else Decimal('0')
            pct_rev = (s['total_revenue'] / grand_total_rev * 100) if grand_total_rev else Decimal('0')

            entry = {
                'size': size_code,
                'total_quantity': s['total_quantity'],
                'total_revenue': s['total_revenue'],
                'weighted_avg_fob': round(weighted_avg_fob, 2) if weighted_avg_fob else None,
                'percent_of_total_quantity': round(pct_qty, 1),
                'percent_of_total_revenue': round(pct_rev, 1),
            }

            if group_by in ('farm', 'field'):
                entry['by_farm'] = sorted([
                    {
                        'farm_name': fd['farm_name'],
                        'quantity': fd['quantity'],
                        'revenue': fd['revenue'],
                        'avg_fob': round(fd['revenue'] / fd['quantity'], 2) if fd['quantity'] else None,
                    }
                    for fd in s['by_farm'].values()
                ], key=lambda x: x['farm_name'])

            results.append(entry)

        overall_avg_fob = (grand_total_rev / grand_total_qty) if grand_total_qty else None

        return {
            'sizes': results,
            'totals': {
                'total_quantity': grand_total_qty,
                'total_revenue': grand_total_rev,
                'overall_avg_fob': round(overall_avg_fob, 2) if overall_avg_fob else None,
            },
        }

    # -----------------------------------------------------------------
    # packinghouse_dashboard
    # -----------------------------------------------------------------
    @staticmethod
    def packinghouse_dashboard(company, season_id=None):
        available_seasons = Pool.objects.filter(
            packinghouse__company=company
        ).values_list('season', flat=True).distinct().order_by('-season')
        available_seasons = list(available_seasons)

        today = date.today()
        current_season = get_citrus_season(today)
        default_season = current_season.label

        selected_season = season_id or default_season

        if selected_season not in available_seasons and available_seasons:
            selected_season = available_seasons[0]

        active_pools = Pool.objects.filter(
            packinghouse__company=company,
            status='active',
            season=selected_season
        ).count()

        total_pools = Pool.objects.filter(
            packinghouse__company=company,
            season=selected_season
        ).count()

        total_bins = PackinghouseDelivery.objects.filter(
            pool__packinghouse__company=company,
            pool__season=selected_season
        ).aggregate(total=Coalesce(Sum('bins'), Decimal('0')))['total']

        pending_settlement = Pool.objects.filter(
            packinghouse__company=company,
            status='closed',
            season=selected_season
        ).exclude(settlements__isnull=False).count()

        recent_deliveries = PackinghouseDelivery.objects.filter(
            pool__packinghouse__company=company,
            pool__season=selected_season
        ).select_related('pool', 'field').order_by('-delivery_date', '-created_at')[:5]

        recent_packouts = PackoutReport.objects.filter(
            pool__packinghouse__company=company,
            pool__season=selected_season
        ).select_related('pool', 'field').order_by('-report_date')[:5]

        packinghouse_summary = Packinghouse.objects.filter(
            company=company,
            is_active=True
        ).annotate(
            active_pools=Count('pools', filter=Q(pools__status='active', pools__season=selected_season)),
            total_pools=Count('pools', filter=Q(pools__season=selected_season)),
            season_bins=Coalesce(
                Sum('pools__deliveries__bins', filter=Q(pools__season=selected_season)),
                Decimal('0')
            ),
            total_settlements=Coalesce(
                Sum('pools__settlements__net_return', filter=Q(pools__season=selected_season)),
                Decimal('0')
            )
        ).values('id', 'name', 'short_code', 'active_pools', 'total_pools', 'season_bins', 'total_settlements')

        return {
            'selected_season': selected_season,
            'available_seasons': available_seasons,
            'active_pools': active_pools,
            'total_pools': total_pools,
            'total_bins_this_season': total_bins,
            'pending_settlement': pending_settlement,
            'recent_deliveries': recent_deliveries,
            'recent_packouts': recent_packouts,
            'packinghouse_summary': list(packinghouse_summary),
        }

    # -----------------------------------------------------------------
    # harvest_packing_pipeline
    # -----------------------------------------------------------------
    @staticmethod
    def harvest_packing_pipeline(company, selected_commodity=None, season_id=None, breakdown_param=None):
        today = date.today()

        # ---- MODE A: ALL COMMODITIES OVERVIEW ----
        if not selected_commodity:
            commodities = list(
                Pool.objects.filter(
                    packinghouse__company=company
                ).values_list('commodity', flat=True).distinct().order_by('commodity')
            )

            packout_by_cs = PackoutReport.objects.filter(
                pool__packinghouse__company=company
            ).values('pool__commodity', 'pool__season').annotate(
                total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
                avg_pack_percent=Avg('total_packed_percent'),
                report_count=Count('id'),
            )

            settlement_by_cs = PoolSettlement.objects.filter(
                pool__packinghouse__company=company
            ).values('pool__commodity', 'pool__season').annotate(
                total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
                total_lbs_settled=Coalesce(Sum('total_weight_lbs'), Decimal('0')),
                total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
                avg_per_bin=Avg('net_per_bin'),
                avg_per_lb=Avg('net_per_lb'),
                settlement_count=Count('id'),
            )

            pool_status_by_cs = Pool.objects.filter(
                packinghouse__company=company
            ).values('commodity', 'season', 'status').annotate(count=Count('id'))

            commodity_cards = []
            total_revenue = Decimal('0')
            total_bins_packed = Decimal('0')
            total_bins_settled = Decimal('0')

            for commodity_val in commodities:
                if not commodity_val:
                    continue

                crop_category = get_crop_category_for_commodity(commodity_val)
                unit_info = get_primary_unit_for_commodity(commodity_val)
                season_service = SeasonService(company_id=company.id)
                current = season_service.get_current_season(crop_category=crop_category, target_date=today)
                current_season_label = current.label

                bins_packed = Decimal('0')
                avg_pack = 0
                packout_count = 0
                for row in packout_by_cs:
                    if row['pool__commodity'] == commodity_val and row['pool__season'] == current_season_label:
                        bins_packed = row['total_bins_packed']
                        avg_pack = round(float(row['avg_pack_percent'] or 0), 1)
                        packout_count = row['report_count']

                bins_settled = Decimal('0')
                lbs_settled = Decimal('0')
                revenue = Decimal('0')
                avg_per_unit = 0
                settlement_count = 0
                for row in settlement_by_cs:
                    if row['pool__commodity'] == commodity_val and row['pool__season'] == current_season_label:
                        bins_settled = row['total_bins_settled']
                        lbs_settled = row['total_lbs_settled']
                        revenue = row['total_revenue']
                        if unit_info['unit'] == 'LBS':
                            avg_per_unit = round(float(row['avg_per_lb'] or 0), 2)
                        else:
                            avg_per_unit = round(float(row['avg_per_bin'] or 0), 2)
                        settlement_count = row['settlement_count']

                if unit_info['unit'] == 'LBS' and lbs_settled == 0 and settlement_count > 0:
                    grade_line_lbs = SettlementGradeLine.objects.filter(
                        settlement__pool__commodity=commodity_val,
                        settlement__pool__season=current_season_label,
                        settlement__pool__packinghouse__company=company,
                        unit_of_measure='LBS'
                    ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))['total']
                    lbs_settled = grade_line_lbs
                    if lbs_settled > 0 and revenue > 0:
                        avg_per_unit = round(float(revenue / lbs_settled), 2)

                pools = {}
                for row in pool_status_by_cs:
                    if row['commodity'] == commodity_val and row['season'] == current_season_label:
                        pools[row['status']] = row['count']

                if unit_info['unit'] == 'LBS':
                    quantity_packed = float(bins_packed)
                    quantity_settled = float(lbs_settled)
                    settlement_pct = 100.0 if lbs_settled > 0 and bins_packed > 0 else 0
                else:
                    quantity_packed = float(bins_packed)
                    quantity_settled = float(bins_settled)
                    settlement_pct = round((quantity_settled / quantity_packed * 100), 1) if quantity_packed > 0 else 0

                commodity_cards.append({
                    'commodity': commodity_val,
                    'crop_category': crop_category,
                    'current_season': current_season_label,
                    'primary_unit': unit_info['unit'],
                    'primary_unit_label': unit_info['label_plural'],
                    'quantity_packed': quantity_packed,
                    'quantity_settled': quantity_settled,
                    'bins_packed': float(bins_packed),
                    'bins_settled': float(bins_settled),
                    'lbs_settled': float(lbs_settled),
                    'avg_pack_percent': avg_pack,
                    'settlement_percent': settlement_pct,
                    'revenue': float(revenue),
                    'avg_per_unit': avg_per_unit,
                    'avg_per_bin': avg_per_unit if unit_info['unit'] == 'BIN' else 0,
                    'packout_reports': packout_count,
                    'settlements': settlement_count,
                    'pools': {
                        'active': pools.get('active', 0),
                        'closed': pools.get('closed', 0),
                        'settled': pools.get('settled', 0),
                    },
                })

                total_revenue += revenue
                total_bins_packed += bins_packed
                total_bins_settled += bins_settled

            commodity_cards.sort(key=lambda x: x['revenue'], reverse=True)

            total_packed_f = float(total_bins_packed)
            total_settled_f = float(total_bins_settled)

            return {
                'mode': 'all_commodities',
                'available_commodities': commodities,
                'summary': {
                    'total_revenue': float(total_revenue),
                    'total_bins_packed': total_packed_f,
                    'total_bins_settled': total_settled_f,
                    'settlement_percent': round((total_settled_f / total_packed_f * 100), 1) if total_packed_f > 0 else 0,
                    'total_pools': Pool.objects.filter(packinghouse__company=company).count(),
                },
                'commodity_cards': commodity_cards,
            }

        # ---- MODE B: SPECIFIC COMMODITY ----
        crop_category = get_crop_category_for_commodity(selected_commodity)
        season_service = SeasonService(company_id=company.id)

        available_seasons = list(
            Pool.objects.filter(
                packinghouse__company=company,
                commodity__iexact=selected_commodity
            ).values_list('season', flat=True).distinct().order_by('-season')
        )

        current_season = season_service.get_current_season(crop_category=crop_category, target_date=today)
        default_season = current_season.label

        selected_season = season_id or default_season
        if selected_season not in available_seasons and available_seasons:
            selected_season = available_seasons[0]

        try:
            season_start, season_end = parse_season_for_category(selected_season, crop_category)
        except (ValueError, IndexError):
            season_start = current_season.start_date
            season_end = current_season.end_date

        pool_commodity_filter = Q(pool__commodity__iexact=selected_commodity)
        commodity_filter = Q(commodity__iexact=selected_commodity)

        commodity_varieties = get_varieties_for_commodity(selected_commodity)

        harvest_qs = Harvest.objects.filter(
            field__farm__company=company,
            harvest_date__gte=season_start,
            harvest_date__lte=season_end
        )
        if commodity_varieties:
            harvest_qs = harvest_qs.filter(crop_variety__in=commodity_varieties)

        harvest_stats = harvest_qs.aggregate(
            total_harvests=Count('id'),
            total_bins_harvested=Coalesce(Sum('total_bins'), 0),
            total_weight_harvested=Coalesce(Sum('estimated_weight_lbs'), Decimal('0')),
            in_progress=Count('id', filter=Q(status='in_progress')),
            complete=Count('id', filter=Q(status='complete')),
            verified=Count('id', filter=Q(status='verified'))
        )

        delivery_stats = PackinghouseDelivery.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season
        ).aggregate(
            total_deliveries=Count('id'),
            total_bins_delivered=Coalesce(Sum('bins'), Decimal('0')),
            linked_to_harvest=Count('id', filter=Q(harvest__isnull=False)),
            unlinked=Count('id', filter=Q(harvest__isnull=True))
        )

        packout_qs = PackoutReport.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season
        )
        packout_stats = packout_qs.aggregate(
            total_reports=Count('id'),
            total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
            avg_pack_percent=Avg('total_packed_percent'),
            avg_house_percent=Avg('house_avg_packed_percent')
        )

        unit_info = get_primary_unit_for_commodity(selected_commodity)
        is_weight_based = unit_info['unit'] == 'LBS'

        total_lbs_packed = Decimal('0')
        if is_weight_based and packout_stats['total_reports'] > 0:
            total_lbs_packed = PackoutGradeLine.objects.filter(
                packout_report__in=packout_qs,
                unit_of_measure='LBS'
            ).aggregate(total=Coalesce(Sum('quantity_this_period'), Decimal('0')))['total']

        settlement_qs = PoolSettlement.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season
        )

        settlement_stats = settlement_qs.aggregate(
            total_settlements=Count('id'),
            total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
            total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
            total_lbs_settled=Coalesce(Sum('total_weight_lbs'), Decimal('0')),
            avg_per_bin=Avg('net_per_bin'),
            avg_per_lb=Avg('net_per_lb'),
        )

        if is_weight_based and float(settlement_stats['total_lbs_settled']) == 0 and settlement_stats['total_settlements'] > 0:
            grade_line_lbs = SettlementGradeLine.objects.filter(
                settlement__in=settlement_qs,
                unit_of_measure='LBS'
            ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))['total']
            settlement_stats['total_lbs_settled'] = grade_line_lbs

        pool_status = Pool.objects.filter(
            commodity_filter,
            packinghouse__company=company,
            season=selected_season
        ).values('status').annotate(count=Count('id'))
        pool_by_status = {item['status']: item['count'] for item in pool_status}

        # Recent activity
        recent_harvest_qs = Harvest.objects.filter(
            field__farm__company=company,
            harvest_date__gte=season_start,
            harvest_date__lte=season_end
        )
        if commodity_varieties:
            recent_harvest_qs = recent_harvest_qs.filter(crop_variety__in=commodity_varieties)
        recent_harvests = recent_harvest_qs.select_related('field', 'field__farm').order_by('-harvest_date')[:5]

        recent_deliveries = PackinghouseDelivery.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season
        ).select_related('pool', 'pool__packinghouse', 'field', 'harvest').order_by('-delivery_date')[:5]

        recent_packouts = PackoutReport.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season
        ).select_related('pool', 'pool__packinghouse', 'field').order_by('-report_date')[:5]

        recent_settlements = PoolSettlement.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season
        ).select_related('pool', 'pool__packinghouse', 'field').order_by('-statement_date')[:5]

        # Pipeline efficiency
        bins_harvested = harvest_stats['total_bins_harvested'] or 0
        lbs_harvested = float(harvest_stats['total_weight_harvested'] or 0)
        bins_delivered = float(delivery_stats['total_bins_delivered'] or 0)
        bins_packed = float(packout_stats['total_bins_packed'] or 0)
        lbs_packed = float(total_lbs_packed)
        bins_settled = float(settlement_stats['total_bins_settled'] or 0)
        lbs_settled = float(settlement_stats['total_lbs_settled'] or 0)

        if is_weight_based:
            harvested_quantity = lbs_harvested
            packed_quantity = lbs_packed
            settled_quantity = lbs_settled
            raw_progress = round((lbs_settled / lbs_packed * 100), 1) if lbs_packed > 0 else 0
            settlement_progress = min(raw_progress, 100.0)
        else:
            harvested_quantity = bins_harvested
            packed_quantity = bins_packed
            settled_quantity = bins_settled
            raw_progress = round((bins_settled / bins_packed * 100), 1) if bins_packed > 0 else 0
            settlement_progress = min(raw_progress, 100.0)

        has_missing_packouts = settled_quantity > packed_quantity and packed_quantity > 0

        pipeline_efficiency = {
            'harvest_to_delivery': round((bins_delivered / bins_harvested * 100), 1) if bins_harvested > 0 else 0,
            'delivery_to_packout': round((bins_packed / bins_delivered * 100), 1) if bins_delivered > 0 else 0,
            'packout_to_settlement': settlement_progress,
            'overall': min(round((lbs_settled / lbs_packed * 100), 1), 100.0) if is_weight_based and lbs_packed > 0 else (min(round((bins_settled / bins_harvested * 100), 1), 100.0) if bins_harvested > 0 else 0),
            'has_missing_packouts': has_missing_packouts,
        }

        # Format recent activity
        recent_activity = []

        for h in recent_harvests:
            recent_activity.append({
                'type': 'harvest',
                'date': h.harvest_date.isoformat(),
                'description': f"Harvested {h.total_bins} bins from {h.field.name}",
                'field': h.field.name,
                'farm': h.field.farm.name,
                'bins': h.total_bins,
                'status': h.status,
                'id': h.id
            })

        for d in recent_deliveries:
            recent_activity.append({
                'type': 'delivery',
                'date': d.delivery_date.isoformat(),
                'description': f"Delivered {d.bins} bins to {d.pool.packinghouse.name}",
                'packinghouse': d.pool.packinghouse.name,
                'pool': d.pool.name,
                'field': d.field.name if d.field else None,
                'bins': d.bins,
                'ticket': d.ticket_number,
                'linked_harvest': d.harvest_id,
                'id': d.id
            })

        for p in recent_packouts:
            recent_activity.append({
                'type': 'packout',
                'date': p.report_date.isoformat(),
                'description': f"Packout report: {p.total_packed_percent}% packed" if p.total_packed_percent else "Packout report received",
                'packinghouse': p.pool.packinghouse.name,
                'pool': p.pool.name,
                'field': p.field.name if p.field else 'Grower Summary',
                'pack_percent': float(p.total_packed_percent) if p.total_packed_percent else None,
                'house_avg': float(p.house_avg_packed_percent) if p.house_avg_packed_percent else None,
                'id': p.id
            })

        for s in recent_settlements:
            recent_activity.append({
                'type': 'settlement',
                'date': s.statement_date.isoformat(),
                'description': f"Settlement: ${s.net_return:,.2f}" if s.net_return else "Settlement received",
                'packinghouse': s.pool.packinghouse.name,
                'pool': s.pool.name,
                'field': s.field.name if s.field else 'Grower Summary',
                'net_return': float(s.net_return) if s.net_return else None,
                'per_bin': float(s.net_per_bin) if s.net_per_bin else None,
                'id': s.id
            })

        recent_activity.sort(key=lambda x: x['date'], reverse=True)

        # Farm breakdown (optional)
        breakdowns = None
        if breakdown_param == 'farm':
            group_map = {}

            packout_with_field = PackoutReport.objects.filter(
                pool_commodity_filter,
                pool__packinghouse__company=company,
                pool__season=selected_season,
                field__isnull=False
            ).values('field__farm__id', 'field__farm__name').annotate(
                total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
                avg_pack_percent=Avg('total_packed_percent'),
                report_count=Count('id'),
            )
            for row in packout_with_field:
                fid = row['field__farm__id'] or 'unassigned'
                label = row['field__farm__name'] or 'Unassigned'
                group_map.setdefault(fid, {'farm_id': fid, 'label': label})
                group_map[fid]['bins_packed'] = group_map[fid].get('bins_packed', 0) + float(row['total_bins_packed'])
                group_map[fid]['avg_pack_percent'] = round(float(row['avg_pack_percent'] or 0), 1)
                group_map[fid]['packout_reports'] = group_map[fid].get('packout_reports', 0) + row['report_count']

            packout_no_field = PackoutReport.objects.filter(
                pool_commodity_filter,
                pool__packinghouse__company=company,
                pool__season=selected_season,
                field__isnull=True
            ).values('pool__packinghouse__id', 'pool__packinghouse__name').annotate(
                total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
                avg_pack_percent=Avg('total_packed_percent'),
                report_count=Count('id'),
            )
            for row in packout_no_field:
                key = f"ph-{row['pool__packinghouse__id']}"
                label = row['pool__packinghouse__name'] or 'Unknown Packinghouse'
                group_map.setdefault(key, {'farm_id': key, 'label': label})
                group_map[key]['bins_packed'] = group_map[key].get('bins_packed', 0) + float(row['total_bins_packed'])
                group_map[key]['avg_pack_percent'] = round(float(row['avg_pack_percent'] or 0), 1)
                group_map[key]['packout_reports'] = group_map[key].get('packout_reports', 0) + row['report_count']

            settlement_with_field = PoolSettlement.objects.filter(
                pool_commodity_filter,
                pool__packinghouse__company=company,
                pool__season=selected_season,
                field__isnull=False
            ).values('field__farm__id', 'field__farm__name').annotate(
                total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
                total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
                avg_per_bin=Avg('net_per_bin'),
                settlement_count=Count('id'),
            )
            for row in settlement_with_field:
                fid = row['field__farm__id'] or 'unassigned'
                label = row['field__farm__name'] or 'Unassigned'
                group_map.setdefault(fid, {'farm_id': fid, 'label': label})
                group_map[fid]['bins_settled'] = group_map[fid].get('bins_settled', 0) + float(row['total_bins_settled'])
                group_map[fid]['revenue'] = group_map[fid].get('revenue', 0) + float(row['total_revenue'])
                group_map[fid]['avg_per_bin'] = round(float(row['avg_per_bin'] or 0), 2)
                group_map[fid]['settlements'] = group_map[fid].get('settlements', 0) + row['settlement_count']

            settlement_no_field = PoolSettlement.objects.filter(
                pool_commodity_filter,
                pool__packinghouse__company=company,
                pool__season=selected_season,
                field__isnull=True
            ).values('pool__packinghouse__id', 'pool__packinghouse__name').annotate(
                total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
                total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
                avg_per_bin=Avg('net_per_bin'),
                settlement_count=Count('id'),
            )
            for row in settlement_no_field:
                key = f"ph-{row['pool__packinghouse__id']}"
                label = row['pool__packinghouse__name'] or 'Unknown Packinghouse'
                group_map.setdefault(key, {'farm_id': key, 'label': label})
                group_map[key]['bins_settled'] = group_map[key].get('bins_settled', 0) + float(row['total_bins_settled'])
                group_map[key]['revenue'] = group_map[key].get('revenue', 0) + float(row['total_revenue'])
                group_map[key]['avg_per_bin'] = round(float(row['avg_per_bin'] or 0), 2)
                group_map[key]['settlements'] = group_map[key].get('settlements', 0) + row['settlement_count']

            for key, data in group_map.items():
                packed = data.get('bins_packed', 0)
                settled = data.get('bins_settled', 0)
                data['settlement_percent'] = round((settled / packed * 100), 1) if packed > 0 else 0
                data.setdefault('bins_packed', 0)
                data.setdefault('bins_settled', 0)
                data.setdefault('revenue', 0)
                data.setdefault('avg_per_bin', 0)
                data.setdefault('avg_pack_percent', 0)
                data.setdefault('packout_reports', 0)
                data.setdefault('settlements', 0)

            breakdowns = sorted(group_map.values(), key=lambda x: x.get('revenue', 0), reverse=True)

        if is_weight_based:
            avg_per_unit = round(float(settlement_stats['avg_per_lb'] or 0), 2)
        else:
            avg_per_unit = round(float(settlement_stats['avg_per_bin'] or 0), 2)

        return {
            'mode': 'specific_commodity',
            'selected_commodity': selected_commodity,
            'crop_category': crop_category,
            'current_season': selected_season,
            'selected_season': selected_season,
            'available_seasons': available_seasons,
            'primary_unit': unit_info['unit'],
            'primary_unit_label': unit_info['label_plural'],
            'pipeline_stages': {
                'harvest': {
                    'label': 'Harvested',
                    'total_count': harvest_stats['total_harvests'],
                    'total_bins': bins_harvested,
                    'total_lbs': lbs_harvested,
                    'primary_quantity': harvested_quantity,
                    'breakdown': {
                        'in_progress': harvest_stats['in_progress'],
                        'complete': harvest_stats['complete'],
                        'verified': harvest_stats['verified']
                    }
                },
                'delivery': {
                    'label': 'Delivered',
                    'total_count': delivery_stats['total_deliveries'],
                    'total_bins': bins_delivered,
                    'breakdown': {
                        'linked': delivery_stats['linked_to_harvest'],
                        'unlinked': delivery_stats['unlinked']
                    }
                },
                'packout': {
                    'label': 'Packed',
                    'total_count': packout_stats['total_reports'],
                    'total_bins': bins_packed,
                    'total_lbs': lbs_packed,
                    'primary_quantity': packed_quantity,
                    'avg_pack_percent': round(float(packout_stats['avg_pack_percent'] or 0), 1),
                    'avg_house_percent': round(float(packout_stats['avg_house_percent'] or 0), 1)
                },
                'settlement': {
                    'label': 'Settled',
                    'total_count': settlement_stats['total_settlements'],
                    'total_bins': bins_settled,
                    'total_lbs': lbs_settled,
                    'primary_quantity': settled_quantity,
                    'total_revenue': float(settlement_stats['total_revenue'] or 0),
                    'avg_per_bin': round(float(settlement_stats['avg_per_bin'] or 0), 2),
                    'avg_per_unit': avg_per_unit,
                }
            },
            'pool_status': {
                'active': pool_by_status.get('active', 0),
                'closed': pool_by_status.get('closed', 0),
                'settled': pool_by_status.get('settled', 0)
            },
            'pipeline_efficiency': pipeline_efficiency,
            'recent_activity': recent_activity[:15],
            'breakdown_type': breakdown_param,
            'breakdowns': breakdowns,
        }

    # -----------------------------------------------------------------
    # commodity_roi_ranking
    # -----------------------------------------------------------------
    @staticmethod
    def commodity_roi_ranking(company, season_id=None, packinghouse_id=None, group_by='commodity'):
        seasons_with_settlements = PoolSettlement.objects.filter(
            pool__packinghouse__company=company
        ).values_list('pool__season', flat=True).distinct()
        seasons_with_settlements = list(set(seasons_with_settlements))
        seasons_with_settlements.sort(reverse=True)

        all_seasons = Pool.objects.filter(
            packinghouse__company=company
        ).values_list('season', flat=True).distinct().order_by('-season')
        available_seasons = list(all_seasons)

        today = date.today()
        current_season = get_citrus_season(today)
        default_season = current_season.label

        selected_season = season_id or ''
        if not selected_season:
            if seasons_with_settlements:
                selected_season = seasons_with_settlements[0]
            else:
                selected_season = default_season

        group_field = 'pool__variety' if group_by == 'variety' else 'pool__commodity'

        base_filters = Q(
            pool__packinghouse__company=company,
            field__isnull=True
        )
        if packinghouse_id:
            base_filters &= Q(pool__packinghouse_id=packinghouse_id)

        settlements = PoolSettlement.objects.filter(
            base_filters, pool__season=selected_season
        ).select_related('pool')

        groups = defaultdict(lambda: {
            'total_bins': Decimal('0'),
            'total_credits': Decimal('0'),
            'total_deductions': Decimal('0'),
            'net_return': Decimal('0'),
        })

        for s in settlements:
            key = getattr(s.pool, 'variety' if group_by == 'variety' else 'commodity', '') or 'Unknown'
            g = groups[key]
            g['total_bins'] += s.total_bins or Decimal('0')
            g['total_credits'] += s.total_credits or Decimal('0')
            g['total_deductions'] += s.total_deductions or Decimal('0')
            g['net_return'] += s.net_return or Decimal('0')

        rankings = []
        for key, g in groups.items():
            if g['total_bins'] <= 0:
                continue

            gross_per_bin = g['total_credits'] / g['total_bins']
            deductions_per_bin = g['total_deductions'] / g['total_bins']
            net_per_bin = g['net_return'] / g['total_bins']
            margin_percent = round(float(g['net_return'] / g['total_credits'] * 100), 1) if g['total_credits'] > 0 else 0

            unit_info = get_primary_unit_for_commodity(key if group_by == 'commodity' else 'CITRUS')

            rankings.append({
                'group_key': key,
                'total_bins': float(g['total_bins']),
                'gross_per_bin': round(float(gross_per_bin), 2),
                'deductions_per_bin': round(float(deductions_per_bin), 2),
                'net_per_bin': round(float(net_per_bin), 2),
                'margin_percent': margin_percent,
                'total_net_return': float(g['net_return']),
                'primary_unit': unit_info['unit'],
                'primary_unit_label': unit_info['label_plural'],
            })

        rankings.sort(key=lambda x: x['net_per_bin'], reverse=True)

        # Multi-season trend
        trend_seasons = seasons_with_settlements[:5]
        for rank in rankings:
            trend = []
            for trend_season in trend_seasons:
                trend_filters = Q(
                    pool__packinghouse__company=company,
                    field__isnull=True,
                    pool__season=trend_season,
                )
                if packinghouse_id:
                    trend_filters &= Q(pool__packinghouse_id=packinghouse_id)

                if group_by == 'variety':
                    trend_filters &= Q(pool__variety=rank['group_key'])
                else:
                    trend_filters &= Q(pool__commodity=rank['group_key'])

                agg = PoolSettlement.objects.filter(trend_filters).aggregate(
                    total_bins=Coalesce(Sum('total_bins'), Decimal('0')),
                    net_return=Coalesce(Sum('net_return'), Decimal('0')),
                )
                if agg['total_bins'] > 0:
                    trend.append({
                        'season': trend_season,
                        'net_per_bin': round(float(agg['net_return'] / agg['total_bins']), 2),
                    })
            rank['trend'] = trend

        return {
            'season': selected_season,
            'available_seasons': available_seasons,
            'group_by': group_by,
            'rankings': rankings,
        }

    # -----------------------------------------------------------------
    # deduction_creep_analysis
    # -----------------------------------------------------------------
    @staticmethod
    def deduction_creep_analysis(company, packinghouse_id=None, commodity=None):
        seasons_with_settlements = PoolSettlement.objects.filter(
            pool__packinghouse__company=company
        ).values_list('pool__season', flat=True).distinct()
        seasons_list = sorted(set(seasons_with_settlements), reverse=True)[:5]

        if not seasons_list:
            return {
                'seasons': [],
                'categories': [],
                'totals_by_season': {},
            }

        category_order = ['packing', 'assessment', 'pick_haul', 'capital', 'marketing', 'other']
        category_labels = {
            'packing': 'Packing Charges',
            'assessment': 'Assessments',
            'pick_haul': 'Pick & Haul',
            'capital': 'Capital Funds',
            'marketing': 'Marketing',
            'other': 'Other',
        }

        totals_by_season = {}
        category_data = defaultdict(dict)

        for season in seasons_list:
            settlement_filters = Q(
                pool__packinghouse__company=company,
                pool__season=season,
            )
            if packinghouse_id:
                settlement_filters &= Q(pool__packinghouse_id=packinghouse_id)
            if commodity:
                settlement_filters &= Q(pool__commodity__icontains=commodity)

            settlements = PoolSettlement.objects.filter(settlement_filters)
            settlement_ids = list(settlements.values_list('id', flat=True))

            total_bins = settlements.aggregate(
                total=Coalesce(Sum('total_bins'), Decimal('0'))
            )['total']

            if total_bins <= 0:
                continue

            deductions = SettlementDeduction.objects.filter(settlement_id__in=settlement_ids)

            season_deduction_total = Decimal('0')
            for ded in deductions:
                cat = ded.category
                amount = ded.amount or Decimal('0')
                if cat not in category_data:
                    category_data[cat] = {}
                if season not in category_data[cat]:
                    category_data[cat][season] = {'total_amount': Decimal('0')}
                category_data[cat][season]['total_amount'] += amount
                season_deduction_total += amount

            for cat in category_data:
                if season in category_data[cat]:
                    cat_amount = category_data[cat][season]['total_amount']
                    category_data[cat][season]['per_bin'] = round(float(cat_amount / total_bins), 2)

            totals_by_season[season] = {
                'total_amount': float(season_deduction_total),
                'per_bin': round(float(season_deduction_total / total_bins), 2),
                'total_bins': float(total_bins),
            }

        categories_response = []
        for cat in category_order:
            if cat not in category_data:
                continue

            by_season = {}
            season_values = []
            for season in seasons_list:
                if season in category_data[cat]:
                    entry = {
                        'total_amount': float(category_data[cat][season]['total_amount']),
                        'per_bin': category_data[cat][season].get('per_bin', 0),
                        'yoy_change': None,
                    }
                    season_values.append((season, entry))
                    by_season[season] = entry
                else:
                    by_season[season] = {'total_amount': 0, 'per_bin': 0, 'yoy_change': None}

            for i in range(len(season_values) - 1):
                current_season, current = season_values[i]
                _, previous = season_values[i + 1]
                if previous['per_bin'] and previous['per_bin'] != 0:
                    current['yoy_change'] = round(
                        ((current['per_bin'] - previous['per_bin']) / abs(previous['per_bin'])) * 100, 1
                    )

            categories_response.append({
                'category': cat,
                'label': category_labels.get(cat, cat),
                'by_season': by_season,
            })

        totals_seasons = [s for s in seasons_list if s in totals_by_season]
        for i in range(len(totals_seasons) - 1):
            current = totals_by_season[totals_seasons[i]]
            previous = totals_by_season[totals_seasons[i + 1]]
            if previous['per_bin'] and previous['per_bin'] != 0:
                current['yoy_change'] = round(
                    ((current['per_bin'] - previous['per_bin']) / abs(previous['per_bin'])) * 100, 1
                )

        if commodity:
            unit_info = get_primary_unit_for_commodity(commodity)
        else:
            unit_info = get_primary_unit_for_commodity('CITRUS')

        return {
            'seasons': seasons_list,
            'categories': categories_response,
            'totals_by_season': totals_by_season,
            'primary_unit': unit_info['unit'],
            'primary_unit_label': unit_info['label_plural'],
        }

    # -----------------------------------------------------------------
    # grade_size_price_trends
    # -----------------------------------------------------------------
    @staticmethod
    def grade_size_price_trends(company, packinghouse_id=None, commodity=None, grade=None):
        seasons_with_settlements = PoolSettlement.objects.filter(
            pool__packinghouse__company=company
        ).values_list('pool__season', flat=True).distinct()
        seasons_list = sorted(set(seasons_with_settlements), reverse=True)[:5]

        if not seasons_list:
            return {
                'seasons': [],
                'grade_sizes': [],
            }

        grade_size_data = defaultdict(lambda: defaultdict(lambda: {
            'total_quantity': Decimal('0'),
            'total_revenue': Decimal('0'),
        }))

        for season in seasons_list:
            filters = Q(
                settlement__pool__packinghouse__company=company,
                settlement__pool__season=season,
            )
            if packinghouse_id:
                filters &= Q(settlement__pool__packinghouse_id=packinghouse_id)
            if commodity:
                filters &= Q(settlement__pool__commodity__icontains=commodity)
            if grade:
                filters &= Q(grade__icontains=grade)

            grade_lines = SettlementGradeLine.objects.filter(filters).exclude(size='')

            for line in grade_lines:
                key = (line.grade, line.size)
                entry = grade_size_data[key][season]
                entry['total_quantity'] += line.quantity or Decimal('0')
                entry['total_revenue'] += line.total_amount or Decimal('0')

        grade_sizes = []
        for (grade_val, size), season_data in grade_size_data.items():
            by_season = {}
            for season in seasons_list:
                if season in season_data:
                    sd = season_data[season]
                    avg_fob = float(sd['total_revenue'] / sd['total_quantity']) if sd['total_quantity'] > 0 else None
                    by_season[season] = {
                        'avg_fob': round(avg_fob, 2) if avg_fob is not None else None,
                        'quantity': float(sd['total_quantity']),
                        'revenue': float(sd['total_revenue']),
                        'change_vs_prev': None,
                    }
                else:
                    by_season[season] = {
                        'avg_fob': None,
                        'quantity': 0,
                        'revenue': 0,
                        'change_vs_prev': None,
                    }

            for i in range(len(seasons_list) - 1):
                current = by_season[seasons_list[i]]
                previous = by_season[seasons_list[i + 1]]
                if current['avg_fob'] is not None and previous['avg_fob'] is not None and previous['avg_fob'] != 0:
                    current['change_vs_prev'] = round(
                        ((current['avg_fob'] - previous['avg_fob']) / abs(previous['avg_fob'])) * 100, 1
                    )

            grade_sizes.append({
                'grade': grade_val,
                'size': size,
                'by_season': by_season,
            })

        grade_sizes.sort(key=lambda x: (x['grade'], int(x['size']) if x['size'].isdigit() else 999))

        return {
            'seasons': seasons_list,
            'grade_sizes': grade_sizes,
            'filters_applied': {
                'grade': grade,
                'packinghouse': packinghouse_id,
                'commodity': commodity,
            },
        }

    # -----------------------------------------------------------------
    # packinghouse_report_card
    # -----------------------------------------------------------------
    @staticmethod
    def packinghouse_report_card(company, season_id=None, commodity=None):
        seasons_with_settlements = PoolSettlement.objects.filter(
            pool__packinghouse__company=company
        ).values_list('pool__season', flat=True).distinct()
        seasons_list = sorted(set(seasons_with_settlements), reverse=True)

        today = date.today()
        current_season = get_citrus_season(today)
        selected_season = season_id or ''
        if not selected_season:
            selected_season = seasons_list[0] if seasons_list else current_season.label

        settlement_filters = Q(
            pool__packinghouse__company=company,
            pool__season=selected_season,
            field__isnull=True,
        )
        if commodity:
            settlement_filters &= Q(pool__commodity__icontains=commodity)

        settlements = list(
            PoolSettlement.objects.filter(settlement_filters)
            .select_related('pool__packinghouse')
        )

        if not settlements:
            return {
                'season': selected_season,
                'available_seasons': seasons_list,
                'packinghouses': [],
            }

        ph_settlements = defaultdict(list)
        for s in settlements:
            ph_settlements[s.pool.packinghouse_id].append(s)

        settlement_ids = [s.id for s in settlements]
        all_deductions = SettlementDeduction.objects.filter(
            settlement_id__in=settlement_ids
        ).select_related('settlement__pool__packinghouse')

        ph_deductions = defaultdict(list)
        for ded in all_deductions:
            ph_deductions[ded.settlement.pool.packinghouse_id].append(ded)

        packout_filters = Q(
            pool__packinghouse__company=company,
            pool__season=selected_season,
        )
        if commodity:
            packout_filters &= Q(pool__commodity__icontains=commodity)

        packout_reports = PackoutReport.objects.filter(packout_filters).select_related('pool__packinghouse')
        ph_packouts = defaultdict(list)
        for pr in packout_reports:
            ph_packouts[pr.pool.packinghouse_id].append(pr)

        category_order = ['packing', 'assessment', 'pick_haul', 'capital', 'marketing', 'other']
        category_labels = {
            'packing': 'Packing Charges',
            'assessment': 'Assessments',
            'pick_haul': 'Pick & Haul',
            'capital': 'Capital Funds',
            'marketing': 'Marketing',
            'other': 'Other',
        }

        packinghouse_cards = []
        for ph_id, ph_setts in ph_settlements.items():
            ph = ph_setts[0].pool.packinghouse

            total_bins = sum((s.total_bins or Decimal('0')) for s in ph_setts)
            total_credits = sum((s.total_credits or Decimal('0')) for s in ph_setts)
            total_deductions_amt = sum((s.total_deductions or Decimal('0')) for s in ph_setts)
            total_net = sum((s.net_return or Decimal('0')) for s in ph_setts)

            avg_net_per_bin = float(total_net / total_bins) if total_bins > 0 else 0
            avg_deductions_per_bin = float(total_deductions_amt / total_bins) if total_bins > 0 else 0

            house_avg_sum = Decimal('0')
            house_avg_bins = Decimal('0')
            for s in ph_setts:
                if s.house_avg_per_bin and s.total_bins:
                    house_avg_sum += s.house_avg_per_bin * s.total_bins
                    house_avg_bins += s.total_bins
            avg_house_per_bin = float(house_avg_sum / house_avg_bins) if house_avg_bins > 0 else None

            variance_vs_house = round(avg_net_per_bin - avg_house_per_bin, 2) if avg_house_per_bin is not None else None

            pack_pcts = [float(pr.total_packed_percent) for pr in ph_packouts.get(ph_id, []) if pr.total_packed_percent]
            avg_pack_percent = round(sum(pack_pcts) / len(pack_pcts), 1) if pack_pcts else None

            ded_by_cat = defaultdict(lambda: Decimal('0'))
            for ded in ph_deductions.get(ph_id, []):
                ded_by_cat[ded.category] += ded.amount or Decimal('0')

            deduction_breakdown = []
            for cat in category_order:
                if cat in ded_by_cat:
                    cat_amount = ded_by_cat[cat]
                    deduction_breakdown.append({
                        'category': cat,
                        'label': category_labels.get(cat, cat),
                        'total': float(cat_amount),
                        'per_bin': round(float(cat_amount / total_bins), 2) if total_bins > 0 else 0,
                    })

            season_trend = []
            for trend_season in seasons_list[:5]:
                trend_filters = Q(
                    pool__packinghouse_id=ph_id,
                    pool__packinghouse__company=company,
                    pool__season=trend_season,
                    field__isnull=True,
                )
                if commodity:
                    trend_filters &= Q(pool__commodity__icontains=commodity)

                agg = PoolSettlement.objects.filter(trend_filters).aggregate(
                    total_bins=Coalesce(Sum('total_bins'), Decimal('0')),
                    net_return=Coalesce(Sum('net_return'), Decimal('0')),
                )
                if agg['total_bins'] > 0:
                    season_trend.append({
                        'season': trend_season,
                        'net_per_bin': round(float(agg['net_return'] / agg['total_bins']), 2),
                    })

            packinghouse_cards.append({
                'id': ph.id,
                'name': ph.name,
                'short_code': ph.short_code,
                'metrics': {
                    'avg_net_per_bin': round(avg_net_per_bin, 2),
                    'avg_house_per_bin': round(avg_house_per_bin, 2) if avg_house_per_bin is not None else None,
                    'variance_vs_house': variance_vs_house,
                    'total_bins': float(total_bins),
                    'total_credits': float(total_credits),
                    'total_deductions': float(total_deductions_amt),
                    'avg_pack_percent': avg_pack_percent,
                    'deductions_per_bin': round(avg_deductions_per_bin, 2),
                },
                'deduction_breakdown': deduction_breakdown,
                'season_trend': season_trend,
            })

        packinghouse_cards.sort(key=lambda x: x['metrics']['avg_net_per_bin'], reverse=True)

        return {
            'season': selected_season,
            'available_seasons': seasons_list,
            'packinghouses': packinghouse_cards,
        }

    # -----------------------------------------------------------------
    # pack_percent_impact
    # -----------------------------------------------------------------
    @staticmethod
    def pack_percent_impact(company, packinghouse_id=None, commodity=None):
        settlement_filters = Q(
            pool__packinghouse__company=company,
            field__isnull=False,
            net_per_bin__isnull=False,
        )
        if packinghouse_id:
            settlement_filters &= Q(pool__packinghouse_id=packinghouse_id)
        if commodity:
            settlement_filters &= Q(pool__commodity__icontains=commodity)

        settlements = list(
            PoolSettlement.objects.filter(settlement_filters)
            .select_related('pool__packinghouse', 'field')
        )

        if not settlements:
            return {
                'data_points': [],
                'regression': None,
                'insight': 'No field-level settlement data available.',
            }

        pool_field_pairs = set((s.pool_id, s.field_id) for s in settlements)
        packout_filter = Q()
        for pool_id, field_id in pool_field_pairs:
            packout_filter |= Q(pool_id=pool_id, field_id=field_id)

        packout_lookup = {}
        if packout_filter:
            for pr in PackoutReport.objects.filter(packout_filter).order_by('pool_id', 'field_id', '-report_date'):
                key = (pr.pool_id, pr.field_id)
                if key not in packout_lookup:
                    packout_lookup[key] = pr

        data_points = []
        for s in settlements:
            packout = packout_lookup.get((s.pool_id, s.field_id))
            if packout and packout.total_packed_percent:
                data_points.append({
                    'field_name': s.field.name if s.field else 'Unknown',
                    'season': s.pool.season,
                    'pack_percent': float(packout.total_packed_percent),
                    'net_per_bin': float(s.net_per_bin),
                    'packinghouse_name': s.pool.packinghouse.name,
                    'commodity': s.pool.commodity or '',
                })

        data_points.sort(key=lambda x: x['pack_percent'])

        regression = None
        insight = 'Insufficient data for regression analysis (need at least 3 data points).'

        if len(data_points) >= 3:
            n = len(data_points)
            x_vals = [dp['pack_percent'] for dp in data_points]
            y_vals = [dp['net_per_bin'] for dp in data_points]

            sum_x = sum(x_vals)
            sum_y = sum(y_vals)
            sum_xy = sum(x * y for x, y in zip(x_vals, y_vals))
            sum_x2 = sum(x * x for x in x_vals)
            sum_y2 = sum(y * y for y in y_vals)

            x_mean = sum_x / n
            y_mean = sum_y / n

            denominator = n * sum_x2 - sum_x * sum_x
            if denominator != 0:
                slope = (n * sum_xy - sum_x * sum_y) / denominator
                intercept = (sum_y - slope * sum_x) / n

                r_numerator = n * sum_xy - sum_x * sum_y
                r_denom_sq = (n * sum_x2 - sum_x ** 2) * (n * sum_y2 - sum_y ** 2)
                r_squared = (r_numerator ** 2 / r_denom_sq) if r_denom_sq > 0 else 0

                regression = {
                    'slope': round(slope, 2),
                    'intercept': round(intercept, 2),
                    'r_squared': round(r_squared, 2),
                    'data_point_count': n,
                    'mean_pack_percent': round(x_mean, 1),
                    'mean_net_per_bin': round(y_mean, 2),
                }

                insight = f'Each 1% improvement in pack percentage = ${abs(round(slope, 2)):.2f}/bin {"additional" if slope > 0 else "lower"} return'

        if commodity:
            unit_info = get_primary_unit_for_commodity(commodity)
        else:
            unit_info = get_primary_unit_for_commodity('CITRUS')

        return {
            'data_points': data_points,
            'regression': regression,
            'insight': insight,
            'primary_unit': unit_info['unit'],
            'primary_unit_label': unit_info['label_plural'],
        }
