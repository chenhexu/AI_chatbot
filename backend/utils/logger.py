import logging
import sys
from pathlib import Path

def setup_logger(name: str = "nblm-backend") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Check if handlers already exist to avoid duplicates
    if not logger.handlers:
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        # File handler for logs/backend.log
        log_dir = Path(__file__).parent.parent.parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / "backend.log"
        
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger

logger = setup_logger()


class QueryLogger:
    """Utility class for logging NotebookLM queries and responses"""

    _query_counter = 0

    @classmethod
    def log_query(cls, request_body: str) -> int:
        """
        Log the start of a query with request details

        Args:
            request_body: The complete request including question and any extra prompts

        Returns:
            The query number for use in response logging
        """
        cls._query_counter += 1
        query_num = cls._query_counter

        # Use logger.info to write to both console and file
        logger.info(f"\n{'=' * 70}")
        logger.info(f"  QUERY #{query_num} - REQUEST TO GOOGLE NOTEBOOKLM")
        logger.info(f"{'=' * 70}")
        for line in request_body.split('\n'):
            logger.info(line)
        logger.info(f"{'=' * 70}")
        logger.info(f"  WAITING FOR RESPONSE...")
        logger.info(f"{'=' * 70}")

        return query_num

    @classmethod
    def log_response(cls, query_num: int, response: str) -> None:
        """
        Log the response from NotebookLM

        Args:
            query_num: The query number (returned from log_query)
            response: The raw response from NotebookLM
        """
        from datetime import datetime

        logger.info(f"\n{'=' * 70}")
        logger.info(f"  QUERY #{query_num} - RESPONSE FROM GOOGLE NOTEBOOKLM")
        logger.info(f"  Timestamp: {datetime.now().isoformat()}")
        logger.info(f"{'=' * 70}")

        # Log response in chunks to avoid truncation
        max_line_length = 10000  # Very high limit
        if len(response) > max_line_length:
            # Log in chunks for very long responses
            for i in range(0, len(response), max_line_length):
                chunk = response[i:i + max_line_length]
                logger.info(f"[RESPONSE CHUNK {i // max_line_length + 1}]")
                for line in chunk.split('\n'):
                    logger.info(line)
        else:
            for line in response.split('\n'):
                logger.info(line)

        logger.info(f"{'=' * 70}")
        logger.info(f"  QUERY #{query_num} - END")
        logger.info(f"{'=' * 70}\n")

    @classmethod
    def reset_counter(cls) -> None:
        """Reset the query counter (mainly for testing)"""
        cls._query_counter = 0
