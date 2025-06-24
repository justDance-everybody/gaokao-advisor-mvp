import pytest
import json
from unittest.mock import patch, MagicMock

# Add the project root to the Python path to allow importing 'app'
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app, kv, DAILY_LIMIT, prepare_prompt, get_daily_key
from datetime import datetime

class MockDateTime(datetime):
    @classmethod
    def utcnow(cls):
        return datetime(2025, 6, 24, 12, 0, 0)

@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def mock_datetime(mocker):
    """Fixture to mock datetime.utcnow to a fixed date."""
    mocker.patch('app.datetime', new=MockDateTime)
    return MockDateTime.utcnow()

@pytest.fixture(autouse=True)
def mock_redis(mocker, mock_datetime):
    """Auto-mock Redis for all tests to prevent actual Redis calls."""
    if not kv:
        yield None
        return

    mock = MagicMock()
    mock.ping.return_value = True
    # Default get for the current mocked day
    mock.get.return_value = '0'
    # Default incr for the current mocked day
    mock.incr.return_value = 1
    
    mocker.patch('app.kv', new=mock)
    yield mock

def test_index_route(client):
    """Test if the index route returns the main page."""
    response = client.get('/')
    assert response.status_code == 200
    assert '<title>高考志愿AI决策顾问</title>' in response.data.decode('utf-8')

def test_prepare_prompt_logic():
    """TCD 2.1: Test the core prompt generation logic."""
    # Input
    user_data = {
        'rawText': '纠结：去复旦大学还是华中科技大学？',
        'province': '上海',
        'rank': '4500'
    }
    enrollment_data = {
        'data': {
            '华中科技大学': '计算机科学与技术专业在湖北省扩招5人。'
        }
    }
    # Execution
    prompt = prepare_prompt(user_data, enrollment_data)
    # Assertions
    assert '4500' in prompt
    assert '复旦大学' in prompt
    assert '华中科技大学' in prompt
    assert '扩招5人' in prompt
    assert '<think>' in prompt and '</think>' in prompt

def test_get_usage_success(client, mock_redis):
    """Test the /api/usage endpoint successfully."""
    if not mock_redis:
        pytest.skip("Redis is not configured, skipping test.")
    
    mock_redis.get.return_value = '10'
    response = client.get('/api/usage')
    
    assert response.status_code == 200
    mock_redis.get.assert_called_once_with(get_daily_key())
    data = response.get_json()
    assert data['used'] == 10
    assert data['limit'] == DAILY_LIMIT

def test_get_usage_redis_error(client, mock_redis):
    """Test /api/usage when Redis connection fails."""
    if not mock_redis:
        pytest.skip("Redis is not configured, skipping test.")

    mock_redis.get.side_effect = Exception("Redis down")
    response = client.get('/api/usage')
    assert response.status_code == 500
    data = response.get_json()
    assert "error" in data
    assert "Redis down" in data["error"]

def test_handler_limit_exceeded(client, mock_redis):
    """TCD 2.2: Test /api/handler when the daily usage limit is exhausted."""
    if not mock_redis:
        pytest.skip("Redis is not configured, skipping test.")

    daily_key = get_daily_key()
    mock_redis.get.return_value = str(DAILY_LIMIT)
    response = client.post('/api/handler', json={'userInput': {'rawText': 'test'}})
    
    assert response.status_code == 429
    mock_redis.get.assert_called_once_with(daily_key)
    mock_redis.incr.assert_not_called() # Should not increment if limit is reached
    data = response.get_json()
    assert 'error' in data
    assert '已被抢完' in data['error']

@patch('app.OpenAI')
def test_quota_available(mock_openai, client, mock_redis):
    """TCD 2.2: Test that usage is incremented when quota is available."""
    if not mock_redis:
        pytest.skip("Redis is not configured, skipping test.")

    # Mock OpenAI to prevent actual API calls
    mock_stream = MagicMock()
    mock_stream.__iter__.return_value = []
    mock_openai.return_value.chat.completions.create.return_value = mock_stream

    daily_key = get_daily_key()
    mock_redis.get.return_value = str(DAILY_LIMIT - 1)
    
    with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key', 'OPENAI_API_BASE': 'http://test.url'}):
        client.post('/api/handler', json={'userInput': {'rawText': 'test'}})

    mock_redis.get.assert_called_once_with(daily_key)
    mock_redis.incr.assert_called_once_with(daily_key)

def test_handler_redis_error(client, mock_redis):
    """TCD 2.2: Test /api/handler when Redis connection fails."""
    if not mock_redis:
        pytest.skip("Redis is not configured, skipping test.")

    mock_redis.get.side_effect = Exception("Connection Error")
    response = client.post('/api/handler', json={'userInput': {'rawText': 'test'}})
    
    assert response.status_code == 500
    data = response.get_json()
    assert 'error' in data
    assert '数据库连接丢失' in data['error']

def test_handler_bad_request(client):
    """Test /api/handler with a malformed request."""
    response = client.post('/api/handler', json={'wrong_key': 'test'})
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data
    assert "缺少'userInput'字段" in data['error']

@patch('app.OpenAI')
def test_handler_stream_success(mock_openai, client, mock_redis):
    """Test a successful streaming response from /api/handler."""
    if not mock_redis:
        pytest.skip("Redis is not configured, skipping test.")
        
    # Mock the OpenAI client and its stream
    mock_stream = MagicMock()
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock()]
    mock_chunk.choices[0].delta.content = "Hello"
    mock_stream.__iter__.return_value = [mock_chunk]

    mock_openai.return_value.chat.completions.create.return_value = mock_stream

    # Mock environment variables
    with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key', 'OPENAI_API_BASE': 'http://test.url'}):
        response = client.post('/api/handler', json={'userInput': {'rawText': 'Analyse this'}})

    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'

    # Check the content of the stream
    stream_content = response.get_data(as_text=True)
    
    # Assert that the usage was incremented and sent
    mock_redis.incr.assert_called_once_with(get_daily_key())
    assert f"event: usage\ndata: {json.dumps({'used': 1, 'limit': DAILY_LIMIT})}" in stream_content
    
    assert f"event: message\ndata: {json.dumps('Hello')}" in stream_content
    assert "event: end\ndata: End of stream" in stream_content

def test_handler_missing_env_vars(client, mocker):
    """Test /api/handler when OpenAI env vars are missing."""
    mocker.patch.dict(os.environ, {"OPENAI_API_KEY": "", "OPENAI_API_BASE": ""}, clear=True)
    
    response = client.post('/api/handler', json={'userInput': {'rawText': 'test'}})
    
    assert response.status_code == 200
    stream_content = response.get_data(as_text=True)
    assert 'event: error' in stream_content
    assert '服务器环境变量' in stream_content

@patch('builtins.open')
def test_handler_file_not_found(mock_open, client):
    """Test /api/handler when the enrollment data file is not found."""
    mock_open.side_effect = FileNotFoundError
    response = client.post('/api/handler', json={'userInput': {'rawText': 'test'}})
    assert response.status_code == 500
    data = response.get_json()
    assert 'error' in data
    assert '关键数据文件丢失' in data['error']