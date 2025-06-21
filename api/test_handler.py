import pytest
import json
from unittest.mock import MagicMock, patch
from http.server import BaseHTTPRequestHandler
from io import BytesIO

# Import the handler class from the actual handler file
# We need to make sure the path is correct for pytest to find the module
from api.handler import handler

# --- Test Data Fixtures ---

@pytest.fixture
def mock_request_factory():
    """Factory to create a mock request object."""
    def _create_mock_request(json_data):
        request_body = json.dumps(json_data).encode('utf-8')
        mock_request = MagicMock(spec=BaseHTTPRequestHandler)
        mock_request.rfile = BytesIO(request_body)
        mock_request.headers = {'Content-Length': str(len(request_body))}
        mock_request.wfile = BytesIO() # To capture output
        return mock_request
    return _create_mock_request

@pytest.fixture
def sample_user_data():
    """Provides sample user data for tests."""
    return {
        "userInput": {
            "province": "湖北",
            "rank": 4500,
            "rawText": "我正在纠结复旦大学和华中科技大学，我是王磊。"
        }
    }

@pytest.fixture
def sample_enrollment_data():
    """Provides sample enrollment data for tests."""
    return {
        "data": {
            "湖北": {
                "物理类": {
                    "华中科技大学": {
                        "计算机科学与技术": { "change": "+5", "notes": "扩招" }
                    }
                }
            }
        }
    }

# --- Test Cases ---

def test_prepare_prompt_logic(sample_user_data, sample_enrollment_data):
    """
    Test Case 2.1: Validates that the prompt is correctly generated.
    """
    # Instantiate the handler to access its methods
    h = handler(request=None, client_address=None, server=None)
    
    # Call the method to be tested
    prompt = h.prepare_prompt(sample_user_data['userInput'], sample_enrollment_data)

    # Assertions
    assert "王磊" in prompt
    assert "4500" in prompt
    assert "复旦大学" in prompt
    assert "华中科技大学" in prompt
    assert "扩招" in prompt
    assert "+5" in prompt
    assert "你是一位顶级的、资深的、充满智慧的高考志愿填报专家" in prompt

@patch('api.handler.kv')
@patch('api.handler.OpenAI')
def test_quota_available(MockOpenAI, mock_kv, mock_request_factory, sample_user_data):
    """
    Test Case 2.2.1: Validates behavior when quota is available.
    """
    # --- Mock Setup ---
    mock_kv.get.return_value = 500
    mock_kv.incr.return_value = 501
    
    # Mock OpenAI client and response
    mock_chat_completion = MagicMock()
    mock_chat_completion.choices[0].message.content = "This is a test report."
    MockOpenAI.return_value.chat.completions.create.return_value = mock_chat_completion

    # --- Execution ---
    mock_request = mock_request_factory(sample_user_data)
    
    # To properly test the handler, we need to simulate the server environment
    # or call the do_POST method directly.
    h = handler(mock_request, ('127.0.0.1', 8000), None)
    h.do_POST()

    # --- Assertions ---
    mock_kv.get.assert_called_once_with('daily_requests_count')
    MockOpenAI.return_value.chat.completions.create.assert_called_once()
    mock_kv.incr.assert_called_once_with('daily_requests_count')
    
    # Check response
    mock_request.wfile.seek(0)
    response_body = json.loads(mock_request.wfile.read())
    assert "report" in response_body
    assert response_body["report"] == "This is a test report."


@patch('api.handler.kv')
def test_quota_exhausted(mock_kv, mock_request_factory, sample_user_data):
    """
    Test Case 2.2.2: Validates behavior when quota is exhausted.
    """
    # --- Mock Setup ---
    mock_kv.get.return_value = 1000 # The limit

    # --- Execution ---
    mock_request = mock_request_factory(sample_user_data)
    h = handler(mock_request, ('127.0.0.1', 8000), None)
    
    # We need to capture the response sent by the handler
    with patch.object(h, 'send_response') as mock_send_response, \
         patch.object(h, 'send_header'), \
         patch.object(h, 'end_headers'):
        h.do_POST()

        # --- Assertions ---
        mock_kv.get.assert_called_once_with('daily_requests_count')
        mock_send_response.assert_called_once_with(429)
        
        h.wfile.seek(0)
        response_body = json.loads(h.wfile.read())
        assert "error" in response_body
        assert "今日名额已满" in response_body["error"]


@patch('api.handler.kv')
def test_kv_database_error(mock_kv, mock_request_factory, sample_user_data):
    """
    Test Case 2.2.3: Validates behavior when the KV database fails.
    """
    # --- Mock Setup ---
    mock_kv.get.side_effect = Exception("Connection Error")

    # --- Execution ---
    mock_request = mock_request_factory(sample_user_data)
    h = handler(mock_request, ('127.0.0.1', 8000), None)

    with patch.object(h, 'send_response') as mock_send_response, \
         patch.object(h, 'send_header'), \
         patch.object(h, 'end_headers'):
        h.do_POST()

        # --- Assertions ---
        mock_kv.get.assert_called_once_with('daily_requests_count')
        mock_send_response.assert_called_once_with(500)
        
        h.wfile.seek(0)
        response_body = json.loads(h.wfile.read())
        assert "error" in response_body
        assert "服务暂时不可用" in response_body["error"]