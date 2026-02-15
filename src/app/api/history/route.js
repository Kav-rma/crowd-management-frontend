export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const minutes = searchParams.get("minutes") || "2";

  try {
    const response = await fetch(
      `http://127.0.0.1:5001/history?minutes=${minutes}`,
      { cache: "no-store" }
    );
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json([], { status: 503 });
  }
}
