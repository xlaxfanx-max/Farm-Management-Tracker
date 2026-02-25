"""
PUR PDF Parser for TELUS Agronomy exports.

Parses Product Use Report PDFs into structured data. These PDFs have a consistent
layout across all applicators (Ag Rx, Hansen Pest Control, Aspen AG Helicopters).

Usage:
    from api.services.pur_parser import parse_pur_pdf

    results = parse_pur_pdf('/path/to/file.pdf')
    # Returns: list of dicts, one per PUR report found in the PDF
"""

import re
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

logger = logging.getLogger(__name__)


# Known BeeWhere boilerplate text to strip from comments
BEEWHERE_PATTERNS = [
    r'BeeWhere.*?(?=\n[A-Z]|\Z)',
    r'Bees may be present.*?(?=\n[A-Z]|\Z)',
    r'PROTECT POLLINATORS.*?(?=\n[A-Z]|\Z)',
]

# Rate unit mappings
RATE_UNIT_MAP = {
    'Ga/A': 'Ga/A',
    'Floz/A': 'Floz/A',
    'Qt/A': 'Qt/A',
    'Pt/A': 'Pt/A',
    'Lb/A': 'Lb/A',
    'Oz/A': 'Oz/A',
}

# Amount unit mappings
AMOUNT_UNIT_MAP = {
    'Ga': 'Ga',
    'Floz': 'Floz',
    'Qt': 'Qt',
    'Pt': 'Pt',
    'Lb': 'Lb',
    'Oz': 'Oz',
}

# Application method mappings
METHOD_MAP = {
    'ground': 'ground',
    'air': 'air',
    'aerial': 'air',
    'other': 'other',
    'chemigation': 'chemigation',
}


def parse_pur_pdf(pdf_path):
    """
    Parse a TELUS Agronomy PUR PDF and return structured data.

    Args:
        pdf_path: Path to the PDF file (string or file-like object)

    Returns:
        List of dicts, one per PUR report found in the PDF.
    """
    import pdfplumber

    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ''
            pages_text.append(f'<<PAGE_START:{page_num}>>\n{text}')

    # Join all page text with markers
    full_text = '\n'.join(pages_text)

    # Split into individual PUR reports
    reports_text = _split_into_reports(full_text)

    results = []
    for report_text in reports_text:
        try:
            # Extract page numbers from markers before stripping them
            source_pages = _extract_page_numbers(report_text)
            # Strip markers before parsing
            clean_text = re.sub(r'<<PAGE_START:\d+>>\n?', '', report_text)
            parsed = _parse_single_report(clean_text)
            if parsed:
                parsed['_source_pages'] = source_pages
                results.append(parsed)
        except Exception as e:
            logger.warning(f"Failed to parse PUR report: {e}", exc_info=True)

    return results


def _extract_page_numbers(text):
    """Extract page numbers from <<PAGE_START:N>> markers in a report section."""
    return sorted(set(int(m) for m in re.findall(r'<<PAGE_START:(\d+)>>', text)))


def _split_into_reports(full_text):
    """Split the full PDF text into individual PUR report sections."""
    # Each report starts with "Product Use Report"
    # Split on this marker, keeping the marker with each section
    parts = re.split(r'(?=Product Use Report\b)', full_text)
    reports = [p.strip() for p in parts if p.strip() and 'Product Use Report' in p]
    return reports


def _parse_single_report(text):
    """Parse a single PUR report text block into a structured dict."""
    result = {
        'pur_number': '',
        'pur_status': 'draft',
        'county': '',
        'section': '',
        'township': '',
        'range': '',
        'baseline': 'S',
        'operator': '',
        'applicator_name': '',
        'applicator_address': '',
        'applicator_id': '',
        'permit_number': '',
        'site_id': '',
        'is_organic': False,
        'is_nursery': False,
        'planted_area_acres': None,
        'location': '',
        'block_id': '',
        'is_pre_plant': False,
        'date_started': None,
        'date_completed': None,
        'treated_area_acres': None,
        'commodity_name': '',
        'commodity_code': '',
        'application_method': 'ground',
        'comments': '',
        'restrictions': '',
        'wind_direction_degrees': None,
        'wind_velocity_mph': None,
        'temperature_start_f': None,
        'temperature_finish_f': None,
        'rei_hours': None,
        'phi_days': None,
        'applied_by': '',
        'recommendation_number': '',
        'created_date': None,
        'products': [],
    }

    lines = text.split('\n')

    # --- PUR number and status ---
    header_match = re.search(
        r'Product Use Report\s+(Sent|Unsent|Draft|Rejected)\s+(\S+)', text
    )
    if header_match:
        status_str = header_match.group(1).lower()
        result['pur_status'] = status_str
        result['pur_number'] = header_match.group(2)

    # --- County ---
    county_match = re.search(r'County\s*\n\s*(\w[\w\s]*?)(?:\n|$)', text)
    if county_match:
        result['county'] = county_match.group(1).strip()

    # --- PLSS ---
    plss_match = re.search(
        r'Sec\.\s*(\d+)\s+Twn\.\s*(\w+)\s+Rng\.\s*(\w+)\s+Base\s*(\w)', text
    )
    if plss_match:
        result['section'] = plss_match.group(1)
        result['township'] = plss_match.group(2)
        result['range'] = plss_match.group(3)
        result['baseline'] = plss_match.group(4)

    # --- Operator ---
    operator_match = re.search(r'Grower/Operator\s*\n\s*(.+?)(?:\n|$)', text)
    if operator_match:
        result['operator'] = operator_match.group(1).strip()

    # --- Applicator ---
    applicator_match = re.search(r'Applicator\s*\n\s*(.+?)(?:\n|$)', text)
    if applicator_match:
        result['applicator_name'] = applicator_match.group(1).strip()

    # Applicator address (line after name)
    addr_match = re.search(
        r'Applicator\s*\n\s*.+?\n\s*(.+?\d{5})', text
    )
    if addr_match:
        result['applicator_address'] = addr_match.group(1).strip()

    # Applicator ID
    appid_match = re.search(r'Applicator ID[#\s]*\n?\s*(\d+)', text)
    if appid_match:
        result['applicator_id'] = appid_match.group(1).strip()

    # --- Permit ---
    permit_match = re.search(r'Permit\s+#?\s*\n?\s*(\w+)', text)
    if permit_match:
        result['permit_number'] = permit_match.group(1).strip()

    # --- Site ID ---
    site_match = re.search(r'Site ID\s*\n\s*(.+?)(?:\n|$)', text)
    if site_match:
        result['site_id'] = site_match.group(1).strip()

    # --- Organic / Nursery ---
    result['is_organic'] = bool(re.search(r'\bOrganic\b.*\bYes\b', text, re.I))
    result['is_nursery'] = bool(re.search(r'\bNursery\b.*\bYes\b', text, re.I))

    # --- Planted area ---
    planted_match = re.search(r'Planted Area[^0-9]*?([\d.]+)', text)
    if planted_match:
        result['planted_area_acres'] = _to_decimal(planted_match.group(1))

    # --- Location / Block ---
    location_match = re.search(r'Location\s*\n\s*(.+?)(?:\n|$)', text)
    if location_match:
        result['location'] = location_match.group(1).strip()

    block_match = re.search(r'Block/Lot\s*\n\s*(.+?)(?:\n|$)', text)
    if block_match:
        result['block_id'] = block_match.group(1).strip()

    # --- Pre-plant ---
    result['is_pre_plant'] = bool(re.search(r'Pre-?[Pp]lant.*\bYes\b', text, re.I))

    # --- Dates ---
    started_match = re.search(
        r'Date/Time Started\s*\n\s*(\d{4}-\d{2}-\d{2})\s*\n\s*(\d{2}:\d{2}:\d{2})', text
    )
    if started_match:
        result['date_started'] = f"{started_match.group(1)}T{started_match.group(2)}"

    completed_match = re.search(
        r'Date/Time Completed\s*\n\s*(\d{4}-\d{2}-\d{2})\s*\n\s*(\d{2}:\d{2}:\d{2})', text
    )
    if completed_match:
        result['date_completed'] = f"{completed_match.group(1)}T{completed_match.group(2)}"

    # --- Treated area ---
    treated_match = re.search(r'Area Treated[^0-9]*?([\d.]+)\s*(Ac|Acres)?', text, re.I)
    if treated_match:
        result['treated_area_acres'] = _to_decimal(treated_match.group(1))

    # --- Commodity ---
    commodity_match = re.search(r'Commodity\s*\n\s*([A-Z]+[\w\s]*?)(?:\s*\(|$|\n)', text)
    if commodity_match:
        result['commodity_name'] = commodity_match.group(1).strip()

    code_match = re.search(r'Commodity Code\s*\n?\s*([\d-]+)', text)
    if code_match:
        result['commodity_code'] = code_match.group(1).strip()

    # If commodity code is in the same line as commodity name
    if not result['commodity_code']:
        code_inline = re.search(r'Commodity\s*\n\s*\w+.*?\(([\d]+-[\d]+)\)', text)
        if code_inline:
            result['commodity_code'] = code_inline.group(1)

    # --- Application method ---
    method_match = re.search(r'Application Method\s*\n\s*(\w+)', text)
    if method_match:
        method_str = method_match.group(1).strip().lower()
        result['application_method'] = METHOD_MAP.get(method_str, 'ground')

    # --- Weather ---
    wind_dir_match = re.search(r'Wind Direction.*?(\d+)\s*deg', text, re.I)
    if wind_dir_match:
        result['wind_direction_degrees'] = int(wind_dir_match.group(1))

    wind_vel_match = re.search(r'Wind Velocity.*?([\d.]+)\s*mph', text, re.I)
    if wind_vel_match:
        result['wind_velocity_mph'] = _to_decimal(wind_vel_match.group(1))

    temp_start_match = re.search(r'Temp.*?Start.*?([\d.]+)\s*[°F]?', text, re.I)
    if temp_start_match:
        result['temperature_start_f'] = _to_decimal(temp_start_match.group(1))

    temp_finish_match = re.search(r'Temp.*?Finish.*?([\d.]+)\s*[°F]?', text, re.I)
    if temp_finish_match:
        result['temperature_finish_f'] = _to_decimal(temp_finish_match.group(1))

    # --- Comments ---
    comments_match = re.search(
        r'Comments\s*\n(.*?)(?=\nRestrictions|\nProduct\s+Name|\nManufacturer|\Z)',
        text, re.DOTALL
    )
    if comments_match:
        comments = comments_match.group(1).strip()
        # Strip BeeWhere boilerplate
        for pattern in BEEWHERE_PATTERNS:
            comments = re.sub(pattern, '', comments, flags=re.DOTALL | re.I).strip()
        result['comments'] = comments

    # --- Restrictions ---
    restrictions_match = re.search(
        r'Restrictions\s*\n(.*?)(?=\nProduct\s+Name|\nManufacturer|\Z)',
        text, re.DOTALL
    )
    if restrictions_match:
        result['restrictions'] = restrictions_match.group(1).strip()

    # --- REI / PHI ---
    rei_match = re.search(r'Re-?Entry Interval\s*\n\s*(\d+)\s*(Hour|Day)', text, re.I)
    if rei_match:
        value = int(rei_match.group(1))
        unit = rei_match.group(2).lower()
        result['rei_hours'] = value if unit.startswith('hour') else value * 24

    phi_match = re.search(r'Pre-?Harvest Interval\s*\n\s*(\d+)\s*Day', text, re.I)
    if phi_match:
        result['phi_days'] = int(phi_match.group(1))

    # --- Applied by ---
    applied_match = re.search(
        r'Applied.*?(?:Supervised)?\s*By\s*\n\s*(.+?)(?:\n|$)', text
    )
    if applied_match:
        result['applied_by'] = applied_match.group(1).strip()

    # --- Recommendation number ---
    rec_match = re.search(r'Converted From\s+(REC[- ]?\d+)', text)
    if rec_match:
        result['recommendation_number'] = rec_match.group(1).replace(' ', '')

    # --- Created date ---
    created_match = re.search(
        r'Created\s*\n\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})', text
    )
    if created_match:
        result['created_date'] = f"{created_match.group(1)}T{created_match.group(2)}"

    # --- Products ---
    result['products'] = _parse_products(text)

    return result


def _parse_products(text):
    """
    Parse product lines from the PUR text.

    Product lines look like:
        Manufacturer Name (optional, on its own line)
        Product Name (EPA-REG#)    AMOUNT UNIT    RATE UNIT    DILUTION UNIT
        (PERCENT% - Active Ingredient)

    Or for products without manufacturer/EPA:
        Product Name (-)    AMOUNT UNIT    RATE UNIT    DILUTION UNIT
    """
    products = []

    # Pattern to match product lines with amounts/rates
    # e.g., "Timectin 0.15 EC Ag (84229-2-AA)    11.56 Ga    20 Floz/A    500 Ga"
    # e.g., "46-0-0 Lo Bi Urea (-)    1110 Lb    15 Lb/A    500 Ga"
    product_line_pattern = re.compile(
        r'^(.+?)\s*'                           # product name
        r'\(([^)]*)\)\s+'                      # (EPA reg# or -)
        r'([\d,.]+)\s+(Ga|Floz|Qt|Pt|Lb|Oz)\s+'  # total amount + unit
        r'([\d,.]+)\s+(Ga/A|Floz/A|Qt/A|Pt/A|Lb/A|Oz/A)\s+'  # rate + unit
        r'([\d,.]+)\s+(Ga|Floz|Qt|Pt|Lb|Oz)',     # dilution + unit
        re.MULTILINE
    )

    # Active ingredient pattern (comes after product line)
    ai_pattern = re.compile(
        r'^\s*\(([\d.]+)%\s*-\s*(.+?)\)\s*$', re.MULTILINE
    )

    # Find all product lines
    lines = text.split('\n')
    sort_order = 0

    # Find indices of product lines
    product_indices = []
    for i, line in enumerate(lines):
        match = product_line_pattern.search(line)
        if match:
            product_indices.append((i, match))

    for idx, (line_idx, match) in enumerate(product_indices):
        product_name = match.group(1).strip()
        epa_raw = match.group(2).strip()
        total_amount = _to_decimal(match.group(3))
        amount_unit = match.group(4)
        rate = _to_decimal(match.group(5))
        rate_unit = match.group(6)
        dilution = _to_decimal(match.group(7))

        epa_reg = epa_raw if epa_raw != '-' else ''

        # Look for manufacturer on the line above
        manufacturer = ''
        if line_idx > 0:
            prev_line = lines[line_idx - 1].strip()
            # Manufacturer line: typically a company name with no numbers/parens/amounts
            if prev_line and not product_line_pattern.search(prev_line):
                # Make sure it's not a header, section, or active ingredient
                if (not prev_line.startswith('(')
                    and not re.match(r'^\d', prev_line)
                    and 'Product' not in prev_line
                    and 'Name' not in prev_line
                    and 'Manufacturer' not in prev_line
                    and 'Dilution' not in prev_line
                    and 'Total Used' not in prev_line
                    and 'Rate' not in prev_line
                    and len(prev_line) > 3
                    and '%' not in prev_line):
                    manufacturer = prev_line

        # Look for active ingredient on the line(s) after
        active_ingredient = ''
        active_ingredient_percent = None
        if line_idx + 1 < len(lines):
            next_line = lines[line_idx + 1].strip()
            ai_match = ai_pattern.match(next_line)
            if ai_match:
                active_ingredient_percent = _to_decimal(ai_match.group(1))
                active_ingredient = ai_match.group(2).strip()

        product_data = {
            'manufacturer': manufacturer,
            'product_name': product_name,
            'epa_registration_number': epa_reg,
            'active_ingredient': active_ingredient,
            'active_ingredient_percent': float(active_ingredient_percent) if active_ingredient_percent else None,
            'total_amount': float(total_amount) if total_amount else 0,
            'amount_unit': amount_unit,
            'rate': float(rate) if rate else 0,
            'rate_unit': rate_unit,
            'dilution_gallons': float(dilution) if dilution else None,
            'sort_order': sort_order,
        }
        products.append(product_data)
        sort_order += 1

    return products


def _to_decimal(value_str):
    """Safely convert a string to Decimal."""
    if not value_str:
        return None
    try:
        cleaned = value_str.replace(',', '')
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None
