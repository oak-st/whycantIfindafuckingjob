"""AI-powered cover letter and Q&A generation using Claude."""
import re
import anthropic


async def generate_cover_letter(
    api_key: str,
    job_title: str,
    company: str,
    job_description: str,
    resume_text: str = "",
) -> str:
    client = anthropic.Anthropic(api_key=api_key)

    resume_section = f"\n\nMy resume:\n{resume_text[:4000]}" if resume_text else ""

    prompt = f"""Write a concise, professional cover letter for the following job.

Job Title: {job_title}
Company: {company}

Job Description:
{job_description[:2000]}
{resume_section}

Instructions:
- 3 short paragraphs (opening, why I'm a fit, closing)
- Professional but genuine tone
- Do not use generic filler phrases like "I am excited to apply"
- Tailor specifically to the role and company
- Keep it under 300 words
- Do not include date, address headers, or "Dear Hiring Manager" — just the body paragraphs"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def score_job_relevance(
    api_key: str,
    job_title: str,
    job_description: str,
    keywords: list[str],
    resume_text: str = "",
) -> int:
    """Return a relevance score 1–10 for how well a job matches the candidate."""
    client = anthropic.AsyncAnthropic(api_key=api_key)

    resume_section = f"\n\nCandidate resume:\n{resume_text[:3000]}" if resume_text else ""

    prompt = (
        f"Rate how well this job matches the candidate. "
        f"Reply with only a single integer from 1 to 10.\n\n"
        f"Job title: {job_title}\n"
        f"Job description: {job_description[:1200]}\n"
        f"Candidate is looking for: {', '.join(keywords)}"
        f"{resume_section}\n\n"
        f"Score (1 = poor match, 10 = perfect match):"
    )

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=5,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    match = re.search(r"\d+", raw)
    score = int(match.group()) if match else 5
    return max(1, min(10, score))


async def generate_custom_answer(
    api_key: str,
    question: str,
    job_title: str,
    company: str,
    job_description: str,
    resume_text: str = "",
) -> str:
    client = anthropic.Anthropic(api_key=api_key)

    resume_section = f"\n\nMy resume:\n{resume_text[:3000]}" if resume_text else ""

    prompt = f"""Answer the following job application question concisely and professionally.

Job: {job_title} at {company}
Job Description (excerpt): {job_description[:800]}
{resume_section}

Question: {question}

Instructions:
- Answer in 2-4 sentences max
- Be specific and relevant to the role
- First-person voice
- No fluff"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()
