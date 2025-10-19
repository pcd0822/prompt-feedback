// 이 파일은 Netlify 서버리스 함수입니다.
// OpenAI API 키를 안전하게 서버 측에서 관리하고 API 요청을 중계(프록시)하는 역할을 합니다.
// 로컬 테스트: `netlify dev` 명령어를 사용하여 실행할 수 있습니다.
// 배포: 이 파일을 `netlify/functions` 디렉토리에 위치시키면 Netlify가 자동으로 함수로 배포합니다.

// 'node-fetch'는 v3부터 ESM 전용이므로, require를 사용하기 위해 v2를 설치해야 합니다.
// Netlify 환경에서는 node-fetch 없이 내장 fetch를 사용할 수 있습니다.
// 여기서는 호환성을 위해 내장 fetch를 가정하고 작성합니다.

exports.handler = async function (event) {
  // POST 요청이 아닌 경우 에러 처리
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: '허용되지 않은 메소드입니다.' }),
    };
  }

  try {
    // Netlify 환경 변수에서 OpenAI API 키를 가져옵니다.
    // Netlify 대시보드 > Site settings > Build & deploy > Environment 에서 설정해야 합니다.
    // 변수 이름: OPENAI_API_KEY
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const { promptText } = JSON.parse(event.body);

    if (!promptText) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: '분석할 텍스트가 없습니다.' }),
      };
    }
    
    // OpenAI API에 보낼 시스템 메시지 (AI의 역할과 지시사항 정의)
    const systemMessage = `당신은 세계 최고의 프롬프트 엔지니어링 전문가입니다. 사용자가 입력한 프롬프트 구조 탐구 내용을 분석하고, 다음 규칙에 따라 구체적이고 실행 가능한 피드백을 제공해야 합니다.

1.  **요약:** 사용자의 입력 내용을 한두 문장으로 명확하게 요약합니다.
2.  **잘한 점:** 프롬프트의 구조적인 강점, 명확성, 독창성 등 긍정적인 측면을 2가지 이상 칭찬합니다.
3.  **개선할 점:** 프롬프트가 가질 수 있는 잠재적인 문제점(모호함, 할루시네이션 유발 가능성, 범용성 부족 등)을 2가지 이상 구체적으로 지적합니다.
4.  **개선 방향 제안:** '개선할 점'에서 지적한 내용을 어떻게 수정하면 좋을지 명확하고 구체적인 대안이나 예시를 제시합니다.

결과는 마크다운 형식으로 정리하여 제목과 목록을 사용해 가독성을 높여주세요.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // 또는 'gpt-4' 등 사용 가능한 모델
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: promptText },
        ],
        temperature: 0.7, // 창의성과 일관성 조절
        max_tokens: 500, // 최대 응답 길이
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        throw new Error('OpenAI API에서 오류가 발생했습니다.');
    }

    const data = await response.json();
    const feedback = data.choices[0].message.content;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feedback }),
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
