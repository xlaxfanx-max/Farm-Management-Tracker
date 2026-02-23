"""
Human-readable labels for CAC Food Safety Manual V5.0 PDF form fields.

Used by the field-schema endpoint to provide friendly names in the
PDF field editor UI.  Labels are sourced from the CACDataMapper
docstrings and the official CAC V5.0 manual.
"""

FIELD_LABELS = {
    # ------------------------------------------------------------------
    # Doc 01 — Ranch Info + Food Safety Policy
    # ------------------------------------------------------------------
    '1-a-100': 'Ranch Name',
    '1-a-101': 'Physical Address',
    '1-a-102': 'City',
    '1-a-103': 'State',
    '1-a-104': 'Country',
    '1-a-105': 'APN / GPS Coordinates',
    '1-a-106': 'Commodities',
    '1-a-107': 'Number of Planted Acres',
    '1-a-108': 'Total Planted Acres',
    '1-a-109': 'Food Safety Coordinator',
    '1-a-110': 'Phone Number',
    '1-a-111': 'Alternate Coordinator',
    '1-a-112': 'Alternate Phone',
    '1-a-114': 'Company Name',
    '1-a-115': 'Policy Approved By',
    '1-a-116': 'Coordinator Title',
    '1-a-117': 'Date Reviewed',

    # ------------------------------------------------------------------
    # Doc 02 — Organizational Structure
    # ------------------------------------------------------------------
    'a21122-1': 'Date',
    'a21122-2': 'Role Title 1',
    'a21122-3': 'Name 1',
    'a21122-4': 'Alternate 1',
    'a21122-5': 'Role Title 2',
    'a21122-6': 'Name 2',
    'a21122-7': 'Alternate 2',
    'a21122-8': 'Role Title 3',
    'a21122-9': 'Name 3',
    'a21122-10': 'Alternate 3',
    'a21122-11': 'Role Title 4',
    'a21122-12': 'Name 4',
    'a21122-13': 'Alternate 4',
    'a21122-14': 'Role Title 5',
    'a21122-15': 'Name 5',
    'a21122-16': 'Alternate 5',
    'a21122-17': 'Role Title 6',
    'a21122-18': 'Name 6',
    'a21122-19': 'Alternate 6',
    'a21122-20': 'Other Worker 1',
    'a21122-21': 'Other Worker 2',
    'a21122-22': 'Other Worker 3',
    'a21122-23': 'Other Worker 4',
    'a21122-24': 'Other Worker 5',

    # ------------------------------------------------------------------
    # Doc 03 — Committee Members List
    # ------------------------------------------------------------------
    '3-a-100': 'Committee Members',

    # ------------------------------------------------------------------
    # Doc 04 — Committee Meeting Log
    # ------------------------------------------------------------------
    '4-a-100': 'Meeting Date',
    '4-a-101': 'Meeting Time',
    '4-a-102': 'Ranch',
    '4-a-103': 'Animal Activity Notes',
    '4-a-104': 'Pesticide Applications Notes',
    '4-a-105': 'Pesticide Records in Binder',
    '4-a-106': 'PHI Followed',
    '4-a-107': 'Fertilizer Applications Notes',
    '4-a-108': 'Fertilizer Records in Binder',
    '4-a-109': 'Water Testing Notes',
    '4-a-110': 'Last Irrigation Water Test Date',
    '4-a-111': 'Worker Training Notes',
    '4-a-112': 'Additional Topics',
    '4-a-113': 'Coordinator Name',
    '4-a-114': 'Attendee 1',
    '4-a-115': 'Attendee 2',
    '4-a-116': 'Attendee 3',
    '4-a-117': 'Attendee 4',
    '4-a-118': 'Attendee 5',
    '4-a-119': 'Attendee 6',
    '4-a-120': 'Attendee 7',
    '4-a-121': 'Attendee 8',
    '4-a-122': 'Attendee 9',
    '4-a-123': 'Date Reviewed',
    '4-a-CheckBox1': 'Animal Activity Reviewed',
    '4-a-CheckBox2': 'Pesticide Applications Reviewed',
    '4-a-CheckBox3': 'Pesticide Records in Binder',
    '4-a-CheckBox4': 'PHI Followed',
    '4-a-CheckBox5': 'Fertilizer Applications Reviewed',
    '4-a-CheckBox6': 'Fertilizer Records in Binder',
    '4-a-CheckBox7': 'Water Testing Reviewed',
    '4-a-CheckBox8': 'Worker Training Reviewed',

    # ------------------------------------------------------------------
    # Doc 05 — Management Verification Review
    # ------------------------------------------------------------------
    '5-a-100': 'Internal Audits Analysis',
    '5-a-101': 'External Audits Analysis',
    '5-a-102': 'Incidents Analysis',
    '5-a-103': 'Complaints Analysis',
    '5-a-104': 'Objectives Analysis',
    '5-a-105': 'Org Structure Analysis',
    '5-a-106': 'SOPs Analysis',
    '5-a-107': 'Training Analysis',
    '5-a-108': 'Equipment Analysis',
    '5-a-109': 'Job Roles Analysis',
    '5-a-110': 'Supplier Program Analysis',
    '5-a-111': 'Committee Analysis',
    '5-a-112': 'Review Attendee 1',
    '5-a-113': 'Review Attendee 2',
    '5-a-114': 'Review Attendee 3',
    '5-a-115': 'Review Attendee 4',
    '5-a-116': 'Review Attendee 5',
    '5-a-117': 'Review Attendee 6',
    '5-a-118': 'Review Attendee 7',
    '5-a-119': 'Review Attendee 8',
    '5-a-120': 'Review Attendee 9',
    '5-a-121': 'Review Attendee 10',
    '5-a-122': 'Review Attendee 11',

    # ------------------------------------------------------------------
    # Doc 09 — NUOCA
    # ------------------------------------------------------------------
    'Date012': 'Occurrence Date',
    'Time012': 'Occurrence Time',
    'Reported012': 'Reported By',
    'Date1012': 'Due Date',
    'Time2012': 'Implemented Date',
    'Release2012': 'CA Number',
    'Reason012': 'Description',
    'Reason1012': 'Root Cause',
    'Reason2012': 'Corrective Steps',
    'a91122a': 'Food Safety Incident',
    'a91122b': 'Contamination Suspected',
    'a91122c': 'Animal Intrusion',
    'a91122d': 'Chemical Spill',
}


def get_field_label(field_name):
    """Return human-readable label for a PDF field, or the raw name if unknown."""
    return FIELD_LABELS.get(field_name, field_name)
