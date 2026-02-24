"""
Reusable serializer mixins to reduce boilerplate.

DynamicFieldsMixin eliminates the need for separate List/Detail serializer
pairs. Define one serializer with all fields, set `list_fields` for the
lightweight list representation, and let the ViewSet pass context.
"""


class DynamicFieldsMixin:
    """
    Restricts serializer fields based on the request action.

    Usage in serializer:
        class MySerializer(DynamicFieldsMixin, serializers.ModelSerializer):
            list_fields = ['id', 'name', 'status']   # fields for list action
            class Meta:
                fields = ['id', 'name', 'status', 'description', 'notes', ...]

    Usage in ViewSet:
        class MyViewSet(CompanyFilteredViewSet):
            serializer_class = MySerializer
            # That's it — no get_serializer_class() override needed.

    The mixin checks the view action from the serializer context. If the
    action is 'list' and `list_fields` is defined, only those fields are
    included. All other actions get the full field set.
    """

    list_fields = None

    def get_fields(self):
        fields = super().get_fields()

        if self.list_fields is None:
            return fields

        # Determine action from view context
        view = self.context.get('view')
        action = getattr(view, 'action', None)

        if action == 'list':
            allowed = set(self.list_fields)
            return {k: v for k, v in fields.items() if k in allowed}

        return fields
