from django.db import models
import requests


def default_deadline_reminder_days():
    """Default days before deadline to send reminders."""
    return [30, 14, 7, 1]


def default_license_reminder_days():
    """Default days before license expiration to send reminders."""
    return [90, 60, 30, 14]


class LocationMixin(models.Model):
    """
    Abstract base class providing GPS and PLSS (Public Land Survey System) fields.
    Used by: Farm, Field, WaterSource
    """

    # GPS Coordinates
    gps_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        verbose_name="Latitude",
        help_text="GPS latitude coordinate (e.g., 34.428500)"
    )
    gps_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        verbose_name="Longitude",
        help_text="GPS longitude coordinate (e.g., -119.229000)"
    )

    # PLSS (Public Land Survey System) - Required for California PUR reports
    plss_section = models.CharField(
        max_length=10,
        blank=True,
        verbose_name="Section",
        help_text="Section number (1-36)"
    )
    plss_township = models.CharField(
        max_length=10,
        blank=True,
        verbose_name="Township",
        help_text="Township (e.g., '4N' for Township 4 North)"
    )
    plss_range = models.CharField(
        max_length=10,
        blank=True,
        verbose_name="Range",
        help_text="Range (e.g., '22W' for Range 22 West)"
    )
    plss_meridian = models.CharField(
        max_length=50,
        blank=True,
        default='San Bernardino',
        verbose_name="Meridian",
        help_text="Base meridian (San Bernardino for Southern CA)"
    )

    class Meta:
        abstract = True

    @property
    def has_coordinates(self):
        """Check if GPS coordinates are set."""
        return self.gps_latitude is not None and self.gps_longitude is not None

    @property
    def has_plss(self):
        """Check if PLSS data is complete."""
        return bool(self.plss_section and self.plss_township and self.plss_range)

    @property
    def coordinates_tuple(self):
        """Return coordinates as (lat, lng) tuple or None."""
        if self.has_coordinates:
            return (float(self.gps_latitude), float(self.gps_longitude))
        return None

    @property
    def plss_display(self):
        """Format PLSS as human-readable string for PUR reports."""
        if self.has_plss:
            return f"Sec {self.plss_section}, T{self.plss_township}, R{self.plss_range}, {self.plss_meridian} M"
        return ""

    def lookup_plss_from_coordinates(self, save=True):
        """
        Call BLM PLSS service to populate PLSS fields from GPS coordinates.
        """
        if not self.has_coordinates:
            return None

        try:
            url = "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/identify"
            params = {
                'geometry': f'{self.gps_longitude},{self.gps_latitude}',
                'geometryType': 'esriGeometryPoint',
                'sr': '4326',
                'layers': 'all',
                'tolerance': '1',
                'mapExtent': f'{float(self.gps_longitude)-0.01},{float(self.gps_latitude)-0.01},{float(self.gps_longitude)+0.01},{float(self.gps_latitude)+0.01}',
                'imageDisplay': '100,100,96',
                'returnGeometry': 'false',
                'f': 'json'
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            for result in data.get('results', []):
                attrs = result.get('attributes', {})
                if 'FRSTDIVNO' in attrs:
                    self.plss_section = str(attrs.get('FRSTDIVNO', ''))
                    self.plss_township = str(attrs.get('TWNSHPNO', '')) + attrs.get('TWNSHPDIR', '')
                    self.plss_range = str(attrs.get('RANGENO', '')) + attrs.get('RANGEDIR', '')
                    self.plss_meridian = attrs.get('PRINESSION', 'San Bernardino')

                    if save:
                        self.save(update_fields=['plss_section', 'plss_township', 'plss_range', 'plss_meridian'])

                    return {
                        'section': self.plss_section,
                        'township': self.plss_township,
                        'range': self.plss_range,
                        'meridian': self.plss_meridian
                    }
            return None
        except Exception as e:
            print(f"PLSS lookup failed: {e}")
            return None
