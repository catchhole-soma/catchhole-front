import type { APIRequestContext } from '@playwright/test';

interface Envelope<T> {
  data: T;
}

interface WorkPurge {
  requestId: string;
  status: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED';
  retryable?: boolean;
}

export async function purgeWorkAndWait(
  request: APIRequestContext,
  apiBaseUrl: string,
  authorization: string,
  workId: string,
) {
  const headers = { Authorization: authorization };
  const deleteResponse = await request.delete(`${apiBaseUrl}/api/v1/works/${workId}`, {
    headers,
    data: { confirmation: '영구 삭제' },
  });
  if (!deleteResponse.ok()) {
    throw new Error(`E2E 작품 삭제 요청 실패: ${deleteResponse.status()} ${await deleteResponse.text()}`);
  }
  const accepted = await deleteResponse.json() as Envelope<WorkPurge>;
  const requestId = accepted.data.requestId;
  const deadline = Date.now() + 30_000;
  let retried = false;

  while (Date.now() < deadline) {
    const statusResponse = await request.get(
      `${apiBaseUrl}/api/v1/works/purge-requests/${requestId}`,
      { headers },
    );
    if (!statusResponse.ok()) {
      throw new Error(`E2E 작품 삭제 상태 조회 실패: ${statusResponse.status()} ${await statusResponse.text()}`);
    }
    const envelope = await statusResponse.json() as Envelope<WorkPurge>;
    const purge = envelope.data;
    if (purge.status === 'COMPLETED') return;
    if (purge.status === 'FAILED' || purge.status === 'PARTIAL_FAILED') {
      if (!purge.retryable || retried) {
        throw new Error(`E2E 작품 삭제 실패: ${purge.status}`);
      }
      const retryResponse = await request.post(
        `${apiBaseUrl}/api/v1/works/purge-requests/${requestId}/retry`,
        { headers },
      );
      if (!retryResponse.ok()) {
        throw new Error(`E2E 작품 삭제 재시도 실패: ${retryResponse.status()} ${await retryResponse.text()}`);
      }
      retried = true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('E2E 작품 삭제가 30초 안에 완료되지 않았습니다.');
}
