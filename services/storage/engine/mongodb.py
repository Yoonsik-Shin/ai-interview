import datetime
from typing import Any, Dict, List, Optional
from pymongo import MongoClient
from utils.log_format import log_json

class MongoDBEngine:
    """Engine for handling MongoDB operations"""

    def __init__(
        self,
        uri: str,
        database_name: str,
        collection_name: str = "interview_messages"
    ):
        self.uri = uri
        self.database_name = database_name
        self.collection_name = collection_name
        self.client: Optional[MongoClient] = None
        self.db = None
        self.collection = None

    def connect(self):
        """Establish connection to MongoDB and ensure indexes"""
        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            self.db = self.client[self.database_name]
            self.collection = self.db[self.collection_name]
            
            # Ensure Unique Index for Idempotency: interview_id + timestamp + role + content_hash (simple version)
            # Actually, interview_id + timestamp + role should be unique enough for interview messages
            self.collection.create_index(
                [("interview_id", 1), ("timestamp", 1), ("role", 1)],
                unique=True,
                name="unique_message_idx"
            )
            
            # Check connection
            self.client.admin.command('ping')
            log_json("mongodb_connected", database=self.database_name, collection=self.collection_name)
        except Exception as e:
            log_json("mongodb_connection_failed", error=str(e))
            raise

    def save_message(self, interview_id: str, payload: Dict[str, Any]):
        """
        Save a single interview message/event with idempotency
        
        Args:
            interview_id: The ID of the interview session
            payload: The message data including role, type, and content
        """
        if self.collection is None:
            log_json("mongodb_not_connected", action="save_message")
            return False

        # Use payload timestamp if exists, otherwise now
        ts = payload.get("timestamp")
        if isinstance(ts, str):
            try:
                # Assuming ISO format from Kafka
                ts = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
            except ValueError:
                ts = datetime.datetime.now(datetime.timezone.utc)
        elif not ts:
            ts = datetime.datetime.now(datetime.timezone.utc)

        document = {
            "interview_id": interview_id,
            "timestamp": ts,
            "role": payload.get("role", "SYSTEM"),
            "type": payload.get("type", "EVENT"),
            "content": payload.get("content", ""),
            "payload": payload.get("payload", {})
        }

        try:
            # Use update_one with upsert for idempotency
            # Match by unique fields
            query = {
                "interview_id": interview_id,
                "timestamp": ts,
                "role": document["role"]
            }
            self.collection.update_one(
                query,
                {"$set": document},
                upsert=True
            )
            log_json("message_synced_idempotent", interview_id=interview_id)
            return True
        except Exception as e:
            log_json("mongodb_save_error", error=str(e), interview_id=interview_id)
            return False

    def get_history(self, interview_id: str) -> List[Dict[str, Any]]:
        """Retrieve chronological history for an interview (Audit trail)"""
        if self.collection is None:
            return []
            
        try:
            cursor = self.collection.find({"interview_id": interview_id}).sort("timestamp", 1)
            return list(cursor)
        except Exception as e:
            log_json("mongodb_fetch_error", error=str(e), interview_id=interview_id)
            return []

    def close(self):
        """Close connection"""
        if self.client:
            self.client.close()
            log_json("mongodb_connection_closed")
