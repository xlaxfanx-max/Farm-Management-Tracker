from django.db import models
from django.utils import timezone


# =============================================================================
# WEATHER CACHE MODEL
# =============================================================================

class WeatherCache(models.Model):
    """
    Cache weather data to minimize API calls to OpenWeatherMap.
    Each farm gets its own cached weather data based on GPS coordinates.
    """
    farm = models.OneToOneField(
        'Farm',
        on_delete=models.CASCADE,
        related_name='weather_cache'
    )
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text="Cached latitude for weather lookup"
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text="Cached longitude for weather lookup"
    )
    weather_data = models.JSONField(
        default=dict,
        help_text="Current weather data from API"
    )
    forecast_data = models.JSONField(
        default=dict,
        null=True,
        blank=True,
        help_text="7-day forecast data from API"
    )
    fetched_at = models.DateTimeField(
        auto_now=True,
        help_text="When weather data was last fetched"
    )

    class Meta:
        verbose_name = "Weather Cache"
        verbose_name_plural = "Weather Caches"

    def __str__(self):
        return f"Weather for {self.farm.name}"

    @property
    def is_current_stale(self):
        """Check if current weather data is older than 30 minutes."""
        from datetime import timedelta
        return timezone.now() - self.fetched_at > timedelta(minutes=30)

    @property
    def is_forecast_stale(self):
        """Check if forecast data is older than 3 hours."""
        from datetime import timedelta
        return timezone.now() - self.fetched_at > timedelta(hours=3)
