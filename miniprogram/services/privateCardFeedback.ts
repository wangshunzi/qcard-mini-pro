import { request } from "./http";
import { invalidateData } from "../stores/dataInvalidation";

export function submitPrivateCardFaceFeedback(id: string, content: string) {
  return request<
    {
      id: string;
      status: "processing";
      content: string;
      createdAt: string;
    },
    { content: string }
  >({
    path: `/api/client/user-private-card-faces/${encodeURIComponent(id)}/feedback`,
    method: "POST",
    data: { content },
  }).then((feedback) => {
    invalidateData("content");
    return feedback;
  });
}
