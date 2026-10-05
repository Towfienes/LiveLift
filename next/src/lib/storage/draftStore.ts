import { UnsyncedDraft } from "@/contracts";

class DraftStore {
  private drafts: UnsyncedDraft[] = [];
  private isOnline = true;

  constructor() {
    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;
      window.addEventListener("online", () => {
        this.isOnline = true;
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
      });
    }
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  public setOnlineStatus(online: boolean) {
    this.isOnline = online;
  }

  public getDrafts(sessionId: string): UnsyncedDraft[] {
    return this.drafts.filter((d) => d.sessionId === sessionId);
  }

  public saveDraft(draft: Omit<UnsyncedDraft, "id" | "deviceLocal" | "confirmedForSubmission" | "submissionStatus">): UnsyncedDraft {
    const newDraft: UnsyncedDraft = {
      ...draft,
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      deviceLocal: true,
      confirmedForSubmission: false,
      submissionStatus: "draft",
    };
    this.drafts.push(newDraft);
    return newDraft;
  }

  public confirmDraft(draftId: string): boolean {
    const draft = this.drafts.find((d) => d.id === draftId);
    if (draft) {
      draft.confirmedForSubmission = true;
      draft.submissionStatus = "submitted";
      return true;
    }
    return false;
  }

  public removeDraft(draftId: string) {
    this.drafts = this.drafts.filter((d) => d.id !== draftId);
  }
}

export const draftStore = new DraftStore();
