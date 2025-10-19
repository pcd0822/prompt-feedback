// 이 파일은 Netlify 서버리스 함수입니다.
// OpenAI API 키를 안전하게 서버 측에서 관리하고 API 요청을 중계(프록시)하는 역할을 합니다.
// 로컬 테스트: `netlify dev` 명령어를 사용하여 실행할 수 있습니다.
// 배포: 이 파일을 `netlify/functions` 디렉토리에 위치시키면 Netlify가 자동으로 함수로 배포합니다.

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
    const systemMessage = `You are an expert prompt engineering analyst. Your task is to analyze the user's submitted text about their prompt engineering exploration. You MUST return a single, valid JSON object and nothing else. The JSON object must have three keys:
1.  "summary": A brief, 1-2 sentence summary of the user's input, in Korean.
2.  "feedback": Constructive feedback in Korean. Use newline characters (\\n) for line breaks. The feedback must include sections for '### 👍 잘한 점', '### 🤔 개선할 점', and '### 💡 구체적인 제안'.
3.  "components": An array of strings representing the core structural elements you identified in the user's prompt (e.g., ["역할", "맥락", "작업", "형식", "제약 조건"]). This is the most critical part. If the user's text describes a prompt structure, you must extract its components. If no clear components are found, return an empty array.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // 최신 모델로 변경하여 JSON 생성 안정성 향상
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: promptText },
        ],
        temperature: 0.5,
        max_tokens: 1000, // 토큰 길이를 넉넉하게 설정
        response_format: { type: "json_object" }, // JSON 출력 모드 활성화
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        // 클라이언트에게 더 친절한 에러 메시지를 전달
        const errorMessage = errorData?.error?.message || 'OpenAI API에서 오류가 발생했습니다.';
        throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // API 응답 파싱 및 유효성 검사
    let resultJson;
    try {
        resultJson = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
        console.error('Failed to parse API response JSON:', parseError);
        throw new Error('API로부터 유효하지 않은 응답을 받았습니다.');
    }
    
    // 필수 키가 모두 있는지 확인
    if (!resultJson.summary || !resultJson.feedback || !Array.isArray(resultJson.components)) {
        console.error('API response is missing required keys:', resultJson);
        throw new Error('API 응답에 필수 데이터가 누락되었습니다.');
    }


    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultJson),
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    return {
      statusCode: 500,
      // 클라이언트가 에러 메시지를 바로 표시할 수 있도록 JSON 형식으로 반환
      body: JSON.stringify({ message: error.message }),
    };
  }
};

