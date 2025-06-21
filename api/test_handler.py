import pytest
import json
from unittest.mock import patch, MagicMock

# Import the Flask app instance from your handler
from api.index import app

@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    with app.test_client() as client:
        yield client

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

def test_prepare_prompt_logic(sample_user_data, sample_enrollment_data):
    """
    Test Case 2.1: Validates that the prompt is correctly generated.
    This test can remain as a direct unit test of the helper function.
    """
    from api.index import prepare_prompt
    prompt = prepare_prompt(sample_user_data['userInput'], sample_enrollment_data)

    # Assertions
    assert "王磊" in prompt
    assert "4500" in prompt
    assert "复旦大学" in prompt
    assert "华中科技大学" in prompt
    assert "扩招" in prompt
    assert "+5" in prompt
    assert "你是一位顶级的、资深的、充满智慧的高考志愿填报专家" in prompt

@patch('api.index.KV')
@patch('api.index.OpenAI')
def test_quota_available(MockOpenAI, MockKV, client, sample_user_data):
    """
    Test Case 2.2.1: Validates behavior when quota is available.
    """
    # --- Mock Setup ---
    # Mock the instance that will be created inside the handler
    mock_kv_instance = MockKV.return_value
    mock_kv_instance.get.return_value = 500
    
    mock_chat_completion = MagicMock()
    mock_chat_completion.choices[0].message.content = "This is a test report."
    MockOpenAI.return_value.chat.completions.create.return_value = mock_chat_completion

    # --- Execution ---
    response = client.post('/', json=sample_user_data)

    # --- Assertions ---
    assert response.status_code == 200
    response_data = response.get_json()
    assert "report" in response_data
    assert response_data["report"] == "This is a test report."
    
    # Assert that the KV class was instantiated and methods were called on the instance
    MockKV.assert_called()
    mock_kv_instance.get.assert_called_with('daily_requests_count')
    MockOpenAI.return_value.chat.completions.create.assert_called_once()
    mock_kv_instance.incr.assert_called_once_with('daily_requests_count')

@patch('api.index.KV')
def test_quota_exhausted(MockKV, client, sample_user_data):
    """
    Test Case 2.2.2: Validates behavior when quota is exhausted.
    """
    # --- Mock Setup ---
    mock_kv_instance = MockKV.return_value
    mock_kv_instance.get.return_value = 1000 # The limit

    # --- Execution ---
    response = client.post('/', json=sample_user_data)

    # --- Assertions ---
    assert response.status_code == 429
    response_data = response.get_json()
    assert "error" in response_data
    assert "今日的免费体验名额已被抢完" in response_data["error"]
    mock_kv_instance.get.assert_called_once_with('daily_requests_count')

@patch('api.index.KV')
def test_kv_database_error(MockKV, client, sample_user_data):
    """
    Test Case 2.2.3: Validates behavior when the KV database fails.
    """
    # --- Mock Setup ---
    mock_kv_instance = MockKV.return_value
    mock_kv_instance.get.side_effect = Exception("Connection Error")

    # --- Execution ---
    response = client.post('/', json=sample_user_data)

    # --- Assertions ---
    assert response.status_code == 500
    response_data = response.get_json()
    assert "error" in response_data
    assert "服务暂时不可用" in response_data["error"]
    mock_kv_instance.get.assert_called_once_with('daily_requests_count')

def test_bad_request_no_json(client):
    """Tests server response when POST request has no JSON body."""
    response = client.post('/', data="this is not json")
    assert response.status_code == 400
    response_data = response.get_json()
    assert "error" in response_data
    assert "请求格式错误" in response_data["error"]