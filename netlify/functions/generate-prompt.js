// 이 파일은 AI가 최종 프롬프트를 생성하는 역할을 담당하는 새로운 Netlify 서버리스 함수입니다.
// 경로: netlify/functions/generate-prompt.js

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: '허용되지 않은 메소드입니다.' }),
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const { components } = JSON.parse(event.body);

    if (!components || Object.keys(components).length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: '프롬프트 구성 요소가 없습니다.' }),
      };
    }
    
    // 사용자 입력을 기반으로 AI에게 전달할 지시사항 생성
    const userContent = `다음 구성 요소들을 바탕으로, 전문가 수준의 정교하고 완성도 높은 프롬프트를 작성해주세요:\n\n${JSON.stringify(components, null, 2)}`;

    const systemMessage = `당신은 세계 최고의 프롬프트 엔지니어입니다. 사용자가 제공한 프롬프트의 핵심 구성요소(JSON 형식)를 기반으로, 하나의 완전하고 정교한 프롬프트를 생성해야 합니다. 
    - 각 구성 요소를 명확한 마크다운 제목(예: '# 역할', '# 작업')으로 구분해주세요.
    - 문장은 간결하고 명확하게 작성하여 AI가 오해 없이 이해하도록 해야 합니다.
    - 최종 결과물은 바로 복사해서 사용할 수 있는 완성된 프롬프트여야 합니다.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        throw new Error('OpenAI API에서 프롬프트 생성 중 오류가 발생했습니다.');
    }

    const data = await response.json();
    const finalPrompt = data.choices[0].message.content;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalPrompt }),
    };

  } catch (error) {
    console.error('Error in generate-prompt function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
