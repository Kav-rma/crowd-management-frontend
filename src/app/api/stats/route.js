export async function GET() {
  try {
    const response = await fetch("http://127.0.0.1:5001/detect", {
      cache: "no-store",
    });
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        current_count: 0,
        density_ratio: 0,
        growth_rate: 0,
        risk_level: "Error",
        risk_score: 0,
        surge_flag: false,
        duration_in_high_state: 0,
        timestamp: new Date().toISOString(),
        error: "AI service unavailable",
      },
      { status: 503 }
    );
  }
}
