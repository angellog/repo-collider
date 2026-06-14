import { useAppState } from '../state';
import IdeaCard from './IdeaCard';

export default function SavedView() {
  const { state } = useAppState();

  if (state.allSaved.length === 0) {
    return (
      <div id="saved-view">
        <div className="empty-state">
          <div className="empty-icon">☆</div>
          <div className="empty-title">No saved ideas</div>
          <div className="empty-sub">Save ideas by clicking the ☆ button on any idea card</div>
        </div>
      </div>
    );
  }

  return (
    <div id="saved-view">
      <div id="ideas-grid">
        {state.allSaved.map(idea => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>
    </div>
  );
}
