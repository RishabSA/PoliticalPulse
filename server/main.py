# uvicorn main:app --reload
# /docs for API documentation

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from scraper import (
    get_google_news_articles_rss,
    get_google_rss_redirect_links,
    scrape_articles,
)
from congress_members import get_congress_members, Congressperson
from dotenv import load_dotenv
import os
from contextlib import asynccontextmanager
from openai import OpenAI
from rep_feedback import get_ai_rep_feedback
from embeddings import get_projected_article_data


logger = logging.getLogger("uvicorn.error")

load_dotenv()
congress_gov_api_key = os.getenv("CONGRESS_GOV_API_KEY")
openai_api_key = os.getenv("OPENAI_API_KEY")


class ReportResponse(BaseModel):
    summary: str
    positives: str
    negatives: str
    improvements: str
    pulseSentiment: int
    article_links: list[str]

    article_projected_urls: list[str]
    article_titles: list[str]
    article_clusters: list[int]
    article_topics: list[str]

    article_tsne_xs: list[float]
    article_tsne_ys: list[float]

    article_pca_xs: list[float]
    article_pca_ys: list[float]


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        house_rep_members, senate_members = get_congress_members(
            api_key=congress_gov_api_key
        )

        logger.info(f"Loaded {len(house_rep_members)} House of Representatives members")
        logger.info(f"Loaded {len(senate_members)} Senate members")

        app.state.house_rep_members = house_rep_members
        app.state.senate_members = senate_members

        yield
    except Exception as e:
        logger.error(f"An error occured while starting the API: {e}")


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://politicalpulse.netlify.app",
        "https://politicalpulse.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = OpenAI(api_key=openai_api_key)


@app.get("/")
def root():
    return {"Name": "PoliticalPulse FastAPI"}


@app.get("/house_rep_members", response_model=list[Congressperson])
def house_rep_members(limit: int = 438) -> list[Congressperson]:
    try:
        return app.state.house_rep_members[0:limit]
    except Exception as e:
        logger.error(
            f"An error occured while getting the House of Representative members: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"An error occured while getting the House of Representative members: {e}",
        )


@app.get("/senate_members", response_model=list[Congressperson])
def senate_members(limit: int = 100) -> list[Congressperson]:
    try:
        return app.state.senate_members[0:limit]
    except Exception as e:
        logger.error(f"An error occured while getting the Senate members: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occured while getting the House of Representative members: {e}",
        )


@app.get("/member_feedback", response_model=ReportResponse)
def get_member_feedback(name: str, limit: int = 25) -> ReportResponse:
    google_news_articles_rss = get_google_news_articles_rss(name, limit=limit)

    google_news_articles_rss_links = [
        article.link for article in google_news_articles_rss
    ]

    article_links = get_google_rss_redirect_links(google_news_articles_rss_links)

    article_data = scrape_articles(article_links)
    scraped_text = ""

    for item in article_data:
        scraped_text += item.get("title", "") + "\n"
        scraped_text += item.get("text", "") + "\n\n"

    model_response = get_ai_rep_feedback(
        openai_client=openai_client,
        scraped_text=scraped_text,
        name=name,
        filter_name=True,
    )

    result_df = get_projected_article_data(
        article_data, rep_name=name, num_topics=3, show_plot=False
    )

    output = ReportResponse(
        **model_response.model_dump(),
        article_links=article_links,
        article_projected_urls=result_df["url"].tolist(),
        article_titles=result_df["title"].tolist(),
        article_clusters=result_df["cluster"].tolist(),
        article_topics=result_df["topic"].tolist(),
        article_tsne_xs=result_df["tsne_x"].tolist(),
        article_tsne_ys=result_df["tsne_y"].tolist(),
        article_pca_xs=result_df["pca_x"].tolist(),
        article_pca_ys=result_df["pca_y"].tolist(),
    )

    return output
