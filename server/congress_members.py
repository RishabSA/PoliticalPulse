import os
import requests
from dotenv import load_dotenv
from pydantic import BaseModel


class Congressperson(BaseModel):
    name: str
    partyName: str
    state: str
    district: int | None = None
    imageUrl: str = ""


def format_name(name):
    if "," in name:
        last, first = name.split(",", 1)
        return f"{first.strip()} {last.strip()}"

    return name.strip()


def get_congress_members(api_key):
    api_url = "https://api.congress.gov/v3"

    params = {
        "api_key": api_key,
        "limit": 250,
        "currentMember": "true",
    }

    # Get data from the first page
    first_page_response = requests.get(f"{api_url}/member", params=params)
    first_page_data = first_page_response.json()

    all_members = first_page_data["members"]
    total = int(first_page_data["pagination"]["count"])

    offset = 0

    # Get data from subsequent pages
    while len(all_members) < total:
        offset += params["limit"]

        page_params = {
            "api_key": api_key,
            "limit": 250,
            "currentMember": "true",
            "offset": offset,
        }

        next_page_response = requests.get(f"{api_url}/member", params=page_params)
        next_page_data = next_page_response.json()

        all_members.extend(next_page_data["members"])

    # print(f"Got {len(all_members)} members of {total}")

    house_rep_members = []
    senate_members = []

    for member in all_members:
        member["name"] = format_name(member["name"])

        if member["terms"]["item"][0]["chamber"] == "House of Representatives":
            if len(member["terms"]["item"]) > 1:
                if member["terms"]["item"][1]["chamber"] == "House of Representatives":
                    house_rep_members.append(member)
                else:
                    senate_members.append(member)
            else:
                house_rep_members.append(member)
        else:
            senate_members.append(member)

    house_rep_members = [
        Congressperson(
            name=member["name"],
            partyName=member["partyName"],
            state=member["state"],
            district=member.get("district", None),
            imageUrl=member["depiction"].get("imageUrl", ""),
        )
        for member in house_rep_members
    ]

    senate_members = [
        Congressperson(
            name=member["name"],
            partyName=member["partyName"],
            state=member["state"],
            district=member.get("district", None),
            imageUrl=(member.get("depiction") or {}).get("imageUrl", ""),
        )
        for member in senate_members
    ]

    return house_rep_members, senate_members


if __name__ == "__main__":
    load_dotenv()
    api_key = os.getenv("CONGRESS_GOV_API_KEY")

    house_rep_members, senate_members = get_congress_members(api_key=api_key)

    print(f"{len(house_rep_members)} House of Representatives members")
    print(f"{len(senate_members)} Senate members")
