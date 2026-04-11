"""Tests for payload builder functions."""

import pytest

from hopthu.app.services.trigger import resolve_source_value, build_payload, _NOT_FOUND


class TestResolveSourceValue:
    """Tests for resolve_source_value function."""

    def test_resolve_extracted_data_simple(self):
        """Test resolving a simple $extracted_data path."""
        extracted_data = {"amount": "500000", "sender": "John"}
        email = {"received_at": "2026-04-09T10:00:00+07:00", "from_email": "test@example.com"}

        result = resolve_source_value("$extracted_data.amount", extracted_data, email)
        assert result == "500000"

    def test_resolve_extracted_data_nested(self):
        """Test resolving a nested $extracted_data path."""
        extracted_data = {"sender": {"bank": "VCB", "name": "John"}, "amount": "500000"}
        email = {"received_at": "2026-04-09T10:00:00+07:00"}

        result = resolve_source_value("$extracted_data.sender.bank", extracted_data, email)
        assert result == "VCB"

    def test_resolve_email_field(self):
        """Test resolving a $email path."""
        extracted_data = {"amount": "500000"}
        email = {"received_at": "2026-04-09T10:00:00+07:00", "from_email": "test@example.com"}

        result = resolve_source_value("$email.received_at", extracted_data, email)
        assert result == "2026-04-09T10:00:00+07:00"

        result = resolve_source_value("$email.from_email", extracted_data, email)
        assert result == "test@example.com"

    def test_resolve_missing_path_returns_not_found(self):
        """Test that missing path returns _NOT_FOUND sentinel."""
        extracted_data = {"amount": "500000"}
        email = {"received_at": "2026-04-09T10:00:00+07:00"}

        result = resolve_source_value("$extracted_data.missing_field", extracted_data, email)
        assert result is _NOT_FOUND

    def test_resolve_missing_nested_path_returns_not_found(self):
        """Test that missing nested path returns _NOT_FOUND sentinel."""
        extracted_data = {"sender": {"bank": "VCB"}}
        email = {}

        result = resolve_source_value("$extracted_data.sender.missing", extracted_data, email)
        assert result is _NOT_FOUND

    def test_resolve_invalid_namespace_returns_not_found(self):
        """Test that invalid namespace returns _NOT_FOUND sentinel."""
        extracted_data = {"amount": "500000"}
        email = {}

        result = resolve_source_value("$invalid_namespace.field", extracted_data, email)
        assert result is _NOT_FOUND

    def test_resolve_deeply_nested(self):
        """Test resolving deeply nested path."""
        extracted_data = {"level1": {"level2": {"level3": {"value": "deep"}}}}
        email = {}

        result = resolve_source_value("$extracted_data.level1.level2.level3.value", extracted_data, email)
        assert result == "deep"

    def test_resolve_empty_string_value(self):
        """Test that empty string values are returned."""
        extracted_data = {"empty": ""}
        email = {}

        result = resolve_source_value("$extracted_data.empty", extracted_data, email)
        assert result == ""

    def test_resolve_numeric_value(self):
        """Test resolving numeric values."""
        extracted_data = {"count": 42, "price": 99.99}
        email = {}

        result = resolve_source_value("$extracted_data.count", extracted_data, email)
        assert result == 42

        result = resolve_source_value("$extracted_data.price", extracted_data, email)
        assert result == 99.99

    def test_resolve_list_value(self):
        """Test resolving list values."""
        extracted_data = {"items": ["a", "b", "c"]}
        email = {}

        result = resolve_source_value("$extracted_data.items", extracted_data, email)
        assert result == ["a", "b", "c"]


class TestBuildPayload:
    """Tests for build_payload function."""

    def test_build_simple_payload(self):
        """Test building a simple payload."""
        field_mappings = [
            {"source": "$extracted_data.amount", "target": "payment.amount"},
            {"source": "$email.received_at", "target": "payment.date"}
        ]
        extracted_data = {"amount": "500000"}
        email = {"received_at": "2026-04-09T10:00:00+07:00"}

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {
            "payment": {"amount": "500000", "date": "2026-04-09T10:00:00+07:00"}
        }

    def test_build_nested_payload(self):
        """Test building a nested payload."""
        field_mappings = [
            {"source": "$extracted_data.sender.bank", "target": "sender.bank_name"},
            {"source": "$extracted_data.amount", "target": "payment.value"},
            {"source": "$email.received_at", "target": "payment.date"}
        ]
        extracted_data = {"sender": {"bank": "VCB"}, "amount": "500000"}
        email = {"received_at": "2026-04-09T10:00:00+07:00"}

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {
            "sender": {"bank_name": "VCB"},
            "payment": {"value": "500000", "date": "2026-04-09T10:00:00+07:00"}
        }

    def test_build_payload_empty_mappings(self):
        """Test building payload with empty mappings."""
        field_mappings = []
        extracted_data = {"amount": "500000"}
        email = {}

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {}

    def test_build_payload_creates_nested_structure(self):
        """Test that payload builder creates nested structure from mappings."""
        field_mappings = [
            {"source": "$extracted_data.amount", "target": "payment.amount"}
        ]
        extracted_data = {"amount": "500000"}
        email = {}

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {"payment": {"amount": "500000"}}

    def test_build_payload_multiple_root_keys(self):
        """Test building payload with multiple root keys."""
        field_mappings = [
            {"source": "$extracted_data.sender_name", "target": "sender.name"},
            {"source": "$extracted_data.amount", "target": "payment.amount"},
            {"source": "$email.received_at", "target": "metadata.timestamp"}
        ]
        extracted_data = {"sender_name": "John", "amount": "500000"}
        email = {"received_at": "2026-04-09T10:00:00+07:00"}

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {
            "sender": {"name": "John"},
            "payment": {"amount": "500000"},
            "metadata": {"timestamp": "2026-04-09T10:00:00+07:00"}
        }

    def test_build_payload_with_null_value(self):
        """Test that null values from source are set correctly."""
        field_mappings = [
            {"source": "$extracted_data.amount", "target": "payment.amount"}
        ]
        extracted_data = {"amount": None}
        email = {}

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {"payment": {"amount": None}}

    def test_build_payload_complex_nested_structure(self):
        """Test building payload with complex nested structure."""
        field_mappings = [
            {"source": "$extracted_data.txn_id", "target": "transaction.id"},
            {"source": "$extracted_data.sender_name", "target": "transaction.parties.sender.name"},
            {"source": "$extracted_data.sender_bank", "target": "transaction.parties.sender.bank"},
            {"source": "$extracted_data.receiver_name", "target": "transaction.parties.receiver.name"},
        ]
        extracted_data = {
            "txn_id": "TXN123",
            "sender_name": "John",
            "sender_bank": "VCB",
            "receiver_name": "Jane"
        }
        email = {}

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {
            "transaction": {
                "id": "TXN123",
                "parties": {
                    "sender": {"name": "John", "bank": "VCB"},
                    "receiver": {"name": "Jane"}
                }
            }
        }

    def test_build_payload_with_email_fields(self):
        """Test building payload with $email source fields."""
        field_mappings = [
            {"source": "$email.from_email", "target": "email_info.from"},
            {"source": "$email.subject", "target": "email_info.subject"},
            {"source": "$email.received_at", "target": "email_info.received"},
        ]
        extracted_data = {}
        email = {
            "from_email": "sender@example.com",
            "subject": "Payment Notification",
            "received_at": "2026-04-09T10:00:00"
        }

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {
            "email_info": {
                "from": "sender@example.com",
                "subject": "Payment Notification",
                "received": "2026-04-09T10:00:00"
            }
        }

    def test_build_payload_missing_source_skipped(self):
        """Test that missing source values are skipped."""
        field_mappings = [
            {"source": "$extracted_data.amount", "target": "payment.amount"},
            {"source": "$email.received_at", "target": "payment.date"}
        ]
        extracted_data = {"amount": "500000"}
        email = {}  # missing received_at

        result = build_payload(field_mappings, extracted_data, email)

        assert result == {"payment": {"amount": "500000"}}