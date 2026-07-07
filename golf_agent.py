"""
Golf Tee Time Reservation Agent

An AI agent powered by Claude that helps reserve tee times at your local golf club.
Provides a conversational interface for checking availability, booking, and managing tee times.

Usage:
    python golf_agent.py

Configuration:
    Copy .env.example to .env and fill in your club details and API key.
    To connect to your actual club's booking system, implement the functions in
    the BOOKING BACKEND section below.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Any

import anthropic
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# BOOKING BACKEND — Lakelands Golf (Playwright) with stub fallback
# ---------------------------------------------------------------------------

try:
    import lakeland_backend as _backend
    _USING_REAL_BACKEND = True
except ImportError:
    _backend = None  # type: ignore
    _USING_REAL_BACKEND = False


def _fetch_available_tee_times(date: str, players: int) -> list[dict]:
    if _USING_REAL_BACKEND:
        return _backend.fetch_available_tee_times(date, players)
    # --- STUB fallback ---
    base_times = ["7:00 AM", "7:12 AM", "7:24 AM", "7:48 AM", "8:00 AM",
                  "8:24 AM", "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM",
                  "2:00 PM", "3:00 PM", "4:00 PM"]
    try:
        d = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return []
    is_weekend = d.weekday() >= 5
    times = []
    for i, t in enumerate(base_times):
        spots = 4 if i % 3 != 1 else 2
        if spots >= players:
            times.append({
                "time": t,
                "available_spots": spots,
                "price_per_player": 65 if is_weekend else 45,
                "cart_included": True,
            })
    return times


def _make_reservation(
    date: str,
    time: str,
    players: int,
    player_names: list[str],
    member_id: str,
) -> dict:
    if _USING_REAL_BACKEND:
        return _backend.make_reservation(date, time, players, player_names, member_id)
    # --- STUB fallback ---
    conf = f"GTT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return {
        "success": True,
        "confirmation_number": conf,
        "message": (
            f"Tee time reserved for {players} player(s) on {date} at {time}. "
            f"Confirmation: {conf}"
        ),
    }


def _cancel_reservation(confirmation_number: str, member_id: str) -> dict:
    if _USING_REAL_BACKEND:
        return _backend.cancel_reservation(confirmation_number, member_id)
    return {"success": True, "message": f"Reservation {confirmation_number} has been cancelled."}


def _fetch_my_reservations(member_id: str) -> list[dict]:
    if _USING_REAL_BACKEND:
        return _backend.fetch_my_reservations(member_id)
    # --- STUB fallback ---
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    return [
        {
            "confirmation_number": "GTT-20240115120000",
            "date": tomorrow,
            "time": "9:00 AM",
            "players": 2,
            "status": "Confirmed",
        }
    ]


# ---------------------------------------------------------------------------
# TOOL DEFINITIONS — what Claude can do
# ---------------------------------------------------------------------------

TOOLS: list[anthropic.types.ToolParam] = [
    {
        "name": "check_availability",
        "description": (
            "Check available tee times at the golf club for a specific date. "
            "Returns time slots with available spots and pricing."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date to check in YYYY-MM-DD format (e.g. 2025-04-15)",
                },
                "players": {
                    "type": "integer",
                    "description": "Number of players in the group (1-4)",
                    "minimum": 1,
                    "maximum": 4,
                },
            },
            "required": ["date", "players"],
        },
    },
    {
        "name": "reserve_tee_time",
        "description": (
            "Book a tee time at the golf club. Requires a confirmed available slot. "
            "Returns a confirmation number on success."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date of tee time in YYYY-MM-DD format",
                },
                "time": {
                    "type": "string",
                    "description": "Tee time (e.g. '9:00 AM') — must be an available slot",
                },
                "players": {
                    "type": "integer",
                    "description": "Number of players",
                    "minimum": 1,
                    "maximum": 4,
                },
                "player_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Names of all players in the group",
                },
            },
            "required": ["date", "time", "players", "player_names"],
        },
    },
    {
        "name": "cancel_reservation",
        "description": "Cancel an existing tee time reservation using its confirmation number.",
        "input_schema": {
            "type": "object",
            "properties": {
                "confirmation_number": {
                    "type": "string",
                    "description": "The confirmation number for the reservation to cancel",
                },
            },
            "required": ["confirmation_number"],
        },
    },
    {
        "name": "view_my_reservations",
        "description": "View all upcoming tee time reservations for the member.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


# ---------------------------------------------------------------------------
# TOOL EXECUTOR — routes tool calls to backend functions
# ---------------------------------------------------------------------------

def execute_tool(name: str, tool_input: dict[str, Any]) -> str:
    member_id = os.getenv("GOLF_CLUB_MEMBER_ID", "DEMO_MEMBER")

    if name == "check_availability":
        slots = _fetch_available_tee_times(
            date=tool_input["date"],
            players=tool_input["players"],
        )
        if not slots:
            return json.dumps({"available": False, "message": "No tee times available for that date."})
        return json.dumps({"available": True, "slots": slots, "date": tool_input["date"]})

    elif name == "reserve_tee_time":
        result = _make_reservation(
            date=tool_input["date"],
            time=tool_input["time"],
            players=tool_input["players"],
            player_names=tool_input.get("player_names", []),
            member_id=member_id,
        )
        return json.dumps(result)

    elif name == "cancel_reservation":
        result = _cancel_reservation(
            confirmation_number=tool_input["confirmation_number"],
            member_id=member_id,
        )
        return json.dumps(result)

    elif name == "view_my_reservations":
        reservations = _fetch_my_reservations(member_id=member_id)
        if not reservations:
            return json.dumps({"reservations": [], "message": "No upcoming reservations found."})
        return json.dumps({"reservations": reservations})

    return json.dumps({"error": f"Unknown tool: {name}"})


# ---------------------------------------------------------------------------
# AGENT — the agentic loop
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a friendly and efficient golf tee time assistant for {club_name}.
You help members check availability, book tee times, view their reservations, and cancel bookings.

Guidelines:
- When booking, always confirm the date, time, number of players, and all player names before reserving.
- Present available tee times in a clear, easy-to-read format showing time, price, and cart info.
- When a reservation is confirmed, clearly state the confirmation number — the member needs it to cancel.
- If a requested time is unavailable, proactively suggest the nearest available alternatives.
- Use natural language for dates (e.g., "this Saturday" → resolve to YYYY-MM-DD using today's date: {today}).
- Today is {today} ({weekday}). The club is open 7 days a week.
- Always be concise but friendly. Golf is meant to be fun!"""


def build_system_prompt() -> str:
    today = datetime.now()
    return SYSTEM_PROMPT.format(
        club_name=os.getenv("GOLF_CLUB_NAME", "the Golf Club"),
        today=today.strftime("%Y-%m-%d"),
        weekday=today.strftime("%A"),
    )


def run_agent_turn(client: anthropic.Anthropic, messages: list[dict]) -> str:
    """Run one full agent turn (may involve multiple tool calls) and return the final text response."""
    while True:
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=build_system_prompt(),
            tools=TOOLS,
            messages=messages,
        )

        # Collect any text to return, and tool calls to process
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
        text_blocks = [b for b in response.content if b.type == "text"]

        # Append full assistant response to history
        messages.append({"role": "assistant", "content": response.content})

        # If no tool calls, we have our final answer
        if response.stop_reason == "end_turn" or not tool_use_blocks:
            return "\n".join(b.text for b in text_blocks if b.text)

        # Execute all tool calls and collect results
        tool_results = []
        for block in tool_use_blocks:
            print(f"  [using tool: {block.name}]")
            result = execute_tool(block.name, block.input)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
            })

        # Feed results back to continue the loop
        messages.append({"role": "user", "content": tool_results})


# ---------------------------------------------------------------------------
# MAIN — interactive CLI
# ---------------------------------------------------------------------------

def main() -> None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.")
        return

    client = anthropic.Anthropic(api_key=api_key)
    messages: list[dict] = []

    club_name = os.getenv("GOLF_CLUB_NAME", "the Golf Club")
    print(f"\n⛳  Golf Tee Time Assistant — {club_name}")
    print("=" * 55)
    print("Ask me to check availability, book a tee time,")
    print("view your reservations, or cancel a booking.")
    print("Type 'quit' or 'exit' to leave.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye! See you on the course!")
            break

        if not user_input:
            continue
        if user_input.lower() in {"quit", "exit", "bye", "goodbye"}:
            print("Goodbye! See you on the course!")
            break

        messages.append({"role": "user", "content": user_input})

        try:
            response = run_agent_turn(client, messages)
            print(f"\nAssistant: {response}\n")
        except anthropic.RateLimitError:
            print("\nAssistant: Rate limit hit — please wait a moment and try again.\n")
            messages.pop()  # Remove the failed user message
        except anthropic.APIError as e:
            print(f"\nAssistant: API error ({e.status_code}): {e.message}\n")
            messages.pop()


if __name__ == "__main__":
    main()
