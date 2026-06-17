export async function POST(request) {
  try {
    const { message, attachments = [] } = await request.json();

    if (!message) {
      return Response.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const textAttachments = attachments.filter((a) => a?.type === 'text' && a?.content);
    const imageAttachments = attachments.filter((a) => a?.type === 'image' && a?.dataUrl);

    const textAttachmentBlock = textAttachments.length
      ? `\n\nAttached references:\n${textAttachments
          .map((a, idx) => `(${idx + 1}) ${a.name || 'Attachment'}:\n${String(a.content).slice(0, 8000)}`)
          .join('\n\n')}`
      : '';

    const baseSystemPrompt =
      'You are a friendly and helpful study buddy who helps students learn and understand complex topics. Provide clear, concise, and encouraging responses.';

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const isVision = imageAttachments.length > 0;
    const body = isVision
      ? {
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: `${baseSystemPrompt} If images are attached, describe what you can see and explain clearly.` },
            {
              role: 'user',
              content: [
                { type: 'text', text: `${message}${textAttachmentBlock}` },
                ...imageAttachments.map((img) => ({
                  type: 'image_url',
                  image_url: { url: img.dataUrl },
                })),
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }
      : {
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: baseSystemPrompt },
            { role: 'user', content: `${message}${textAttachmentBlock}` },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        };

    let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    let data = await response.json();

    if (data.error && isVision) {
      // Fallback to text model if the image-capable request/model is unavailable.
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: baseSystemPrompt },
            {
              role: 'user',
              content: `${message}${textAttachmentBlock}\n\nImage attachments: ${imageAttachments
                .map((img) => img.name || 'image')
                .join(', ')}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      data = await response.json();
    }

    if (data.error) {
      return Response.json(
        { error: data.error.message || 'API Error' },
        { status: 500 }
      );
    }

    const aiResponse = data?.choices?.[0]?.message?.content || 'No response received';

    return Response.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat API Error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
