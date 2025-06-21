import os
import sys
from dotenv import load_dotenv
from vercel_kv import KV

# --- Script Setup ---
# Load environment variables from .env file in the project root
# This allows the script to find the Vercel KV credentials
try:
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    kv = KV()
except Exception as e:
    print(f"Error: Could not connect to Vercel KV.")
    print(f"Please ensure your .env file exists in the project root and contains the correct Vercel KV environment variables.")
    print(f"Underlying error: {e}")
    sys.exit(1)

# --- Key Configuration ---
KV_KEY = 'daily_requests_count'

def print_usage():
    """Prints the help message for the script."""
    print("\nVercel KV Manager for Gaokao Advisor")
    print("------------------------------------")
    print("A simple tool to manage the daily request counter for testing.")
    print("\nUsage:")
    print("  python scripts/kv_manager.py <command> [value]")
    print("\nCommands:")
    print("  get           - Get the current value of the request counter.")
    print("  set <value>   - Set the request counter to a specific integer value.")
    print("  incr [value]  - Increment the counter by a value (default: 1).")
    print("  reset         - Reset the counter to 0.")
    print("\nExamples:")
    print("  python scripts/kv_manager.py get")
    print("  python scripts/kv_manager.py set 999")
    print("  python scripts/kv_manager.py reset")
    print()

def main():
    """Main function to execute commands."""
    args = sys.argv[1:]
    if not args:
        print_usage()
        return

    command = args[0].lower()

    try:
        if command == 'get':
            value = kv.get(KV_KEY) or 0
            print(f"Current value of '{KV_KEY}': {value}")

        elif command == 'set':
            if len(args) < 2:
                print("Error: 'set' command requires a value.")
                print_usage()
                return
            value = int(args[1])
            kv.set(KV_KEY, value)
            print(f"Successfully set '{KV_KEY}' to {value}.")

        elif command == 'incr':
            increment_by = 1
            if len(args) > 1:
                increment_by = int(args[1])
            new_value = kv.incr(KV_KEY, increment_by)
            print(f"Successfully incremented '{KV_KEY}'. New value is {new_value}.")

        elif command == 'reset':
            kv.set(KV_KEY, 0)
            print(f"Successfully reset '{KV_KEY}' to 0.")

        else:
            print(f"Error: Unknown command '{command}'")
            print_usage()

    except ValueError:
        print("Error: Invalid number provided. Please use integers for set/incr values.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()