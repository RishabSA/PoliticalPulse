from pydantic import BaseModel
from openai import OpenAI


class OpenAIResponse(BaseModel):
    summary: str
    positives: str
    negatives: str
    improvements: str
    pulseSentiment: int


def get_ai_rep_feedback(
    openai_client: OpenAI,
    scraped_text: str,
    name: str,
    filter_name: bool = False,
) -> OpenAIResponse:
    if filter_name:
        name = name.lower()
        name_words = name.split()

        scraped_text = scraped_text.strip().lower().replace(name, "[NAME HIDDEN]")
        for word in name_words:
            scraped_text = scraped_text.replace(word, "[NAME HIDDEN]")

    response = openai_client.responses.parse(
        model="gpt-5-mini",
        input=[
            {
                "role": "system",
                "content": """
You are a precise news analyst. Use and analyze the text from the provided articles, and return a valid JSON response that serves as a report on the congressional representative.
Output all text in markdown format, emphasizing important content and keywords by making them bold with markdown. Also, never use "[NAME HIDDEN]" in your response.
Always tend to be more positive in your analysis and scoring, and always prefer positive interpretations. Always place more emphasis on positives and strengths, rather than focusing on any negatives.
When reporting anything negative, use gentle wording and avoid sounding too harsh or overly harmful.

Return this JSON format:
{
    "summary": "<markdown, ~100-150 words; summary of the major opinions, topics, points, and other key aspects from the articles; present positive points first (without labeling them as positive/negative); bold all key terms>",
    "positives": "<markdown bullet list (4-6 items); highlight any positives and strengths from the articles about the representative; easy to read and understand>",
    "negatives": "<markdown bullet list (4-5 items); highlight any negatives or weaknesses from the articles about the representative; use gentle wording; do not be harsh or focus too heavily on any negatives; easy to read and understand>",
    "improvements": "<markdown bullet list (4-6 items); realistic and actionable suggestions/possible improvements for the representative; easy to read and understand>",
    "pulseSentiment": <integer 0-100>,
}

pulseSentiment scoring rubric (0-100)
    0-9: very strongly negative sentiment
	10-19: negative sentiment
	20-39: strong negative sentiment
	40-59: mixed/unclear sentiment
	60-79: positive sentiment
    80-89: strong positive sentiment
	90-100: very strongly positive sentiment

Style & constraints
	Do not add citations, links, or extra fields.
	Do not reveal or infer any masked names.
	Use gentle wording for any negatives (avoid loaded language).
	Base all statements on the text from the articles; avoid speculation altogether.
                    """,
            },
            {"role": "user", "content": f"ARTICLES TEXT:\n\n{scraped_text}"},
        ],
        text_format=OpenAIResponse,
        text={"verbosity": "low"},
    )

    # response = openai_client.responses.parse(
    #     model="gpt-5-mini",  # gpt-5-nano
    #     tools=[{"type": "web_search"}],
    #     input=[
    #         {
    #             "role": "system",
    #             "content": (
    #                 f"You are a precise news analyst. Use and analyze text from articles from the web and return valid JSON about {name}."
    #                 "You have permission to search the web for articles. Do not ask for a follow-up repsonse. Just return the valid output."
    #                 "Determine how positive or negative the sentiment surrounding the congressional representative is (pulseSentiment) between 0 (very negative sentiment) and 100 (very positive sentiment)."
    #                 "Also, write a summary of the major opinions, topics, and more from the articles, as well as the reasoning for positive and negative sentiments surrounding the representative from the articles and constituents."
    #                 "Lastly, write some actionable improvements as suggestions for the representative to improve based on the points and sentiments from the articles."
    #             ),
    #         },
    #     ],
    #     text_format=OpenAIResponse,
    #     text={"verbosity": "low"},
    # )

    return response.output_parsed
