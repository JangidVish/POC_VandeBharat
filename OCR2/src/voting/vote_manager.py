from collections import defaultdict


# A train number must appear in this many frames before it is accepted.
# Raises the bar against single-frame false positives (station boards, ads, etc.)
VOTE_THRESHOLD = 5


class VoteManager:

    def __init__(self, threshold=VOTE_THRESHOLD):
        self.counter = defaultdict(int)
        self.threshold = threshold

    def add_candidates(self, candidates):
        for candidate in candidates:
            self.counter[candidate] += 1

    def get_best_candidate(self):
        if not self.counter:
            return None

        best = max(self.counter, key=self.counter.get)

        if self.counter[best] >= self.threshold:
            return best

        return None

    def reset(self):
        self.counter.clear()

    def get_all_votes(self):
        return dict(sorted(self.counter.items(), key=lambda x: x[1], reverse=True))
