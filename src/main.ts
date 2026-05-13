import { renderUpload } from "./ui/upload";
import { renderReview } from "./ui/review";
import { renderDownload } from "./ui/download";
import { emptyState, type AppState } from "./ui/state";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Geen #app element in de pagina gevonden.");
}

let state: AppState = emptyState();

function gotoUpload(errorMsg?: string): void {
  state = emptyState();
  renderUpload(
    root!,
    {
      onComplete: (s) => {
        state = s;
        if (state.toReview.length === 0) {
          gotoDownload();
        } else {
          gotoReview();
        }
      },
      onError: (msg) => {
        renderUpload(root!, {
          onComplete: () => {},
          onError: () => {},
        });
        gotoUpload(msg);
      },
    },
    errorMsg,
  );
}

function gotoReview(): void {
  renderReview(root!, state, {
    onBevestig: (vervanging) => {
      const huidige = state.toReview[0];
      state.confirmed[huidige.tekst] = vervanging;
      state.toReview = state.toReview.slice(1);
      if (state.toReview.length === 0) {
        gotoDownload();
      } else {
        gotoReview();
      }
    },
    onOverslaan: () => {
      state.toReview = state.toReview.slice(1);
      if (state.toReview.length === 0) {
        gotoDownload();
      } else {
        gotoReview();
      }
    },
    onStop: () => gotoDownload(),
  });
}

function gotoDownload(): void {
  renderDownload(root!, state, {
    onOpnieuw: () => gotoUpload(),
  });
}

gotoUpload();
