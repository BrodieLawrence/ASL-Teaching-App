"""Download example recordings from the Kaggle "asl-signs" dataset.

Google - Isolated Sign Language Recognition: https://www.kaggle.com/competitions/asl-signs
You must have joined the competition on Kaggle, and set KAGGLE_API_TOKEN
(from kaggle.com > Settings > API) unless your network adds it for you.

For each word in word_list.txt this picks EXAMPLES_PER_WORD recordings spread
across many signers, plus a few recordings from HOLDOUT_SIGNERS people who are
kept out of the examples entirely, to test accuracy on people the app has never seen.

Output (in tools/cache/, not committed):
  examples.json  recordings used as the app's examples
  holdout.json   recordings used only for testing
Each recording: {"word", "frames": [{"L", "R", "pose"}]} in camera coordinates,
the same raw format the web page records (see js/recorder.js).

Usage: python3 tools/download_dataset.py     (needs: pip install pyarrow)
Options:
  --cached-only      skip files that aren't downloaded yet (e.g. when Kaggle rate-limits)
  --words FILE       word list to use instead of word_list.txt
  --examples N       examples per word (default 40)
  --holdout N        test recordings per word (default 20)
  --out NAME         save as NAME-examples.json / NAME-holdout.json instead
"""
import argparse, collections, csv, io, json, os, random, sys, time, urllib.error, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

EXAMPLES_PER_WORD = 40
HOLDOUT_SIGNERS = 3
HOLDOUT_PER_WORD = 20
RANDOM_SEED = 7

TOOLS = Path(__file__).parent
CACHE = TOOLS / "cache"
API = "https://www.kaggle.com/api/v1/competitions.CompetitionApiService/DownloadDataFile"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def download(file_name: str) -> bytes:
    """Ask Kaggle for a temporary link to one dataset file, then fetch it."""
    headers = {"Content-Type": "application/json"}
    if os.environ.get("KAGGLE_API_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["KAGGLE_API_TOKEN"]
    body = json.dumps({"competitionName": "asl-signs", "fileName": file_name}).encode()
    request = urllib.request.Request(API, data=body, headers=headers, method="POST")
    try:
        urllib.request.build_opener(NoRedirect).open(request)
        raise RuntimeError("Kaggle did not return a download link")
    except urllib.error.HTTPError as err:
        if err.code not in (301, 302, 303, 307):
            raise
        link = err.headers["Location"]
    data = urllib.request.urlopen(link).read()
    if data[:2] == b"PK":  # some files arrive zipped
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            data = z.read(z.namelist()[0])
    return data


def cached(file_name: str) -> Path:
    path = CACHE / "files" / file_name.replace("/", "_")
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(1000):
            try:
                data = download(file_name)
                break
            except urllib.error.HTTPError as err:
                if err.code != 429 or attempt == 999:
                    raise
                # Kaggle asked us to slow down; wait as long as it says (it can take a while).
                time.sleep(int(err.headers.get("Retry-After", 30)) + 1)
        path.write_bytes(data)
    return path


def read_recording(path: Path) -> list:
    """Convert one dataset file to raw frames: hands as 42 numbers, pose as nose + shoulders."""
    table = pq.read_table(path).to_pandas()
    frames = []
    for _, g in table.groupby("frame"):
        def points(kind):
            xy = g[g.type == kind].sort_values("landmark_index")[["x", "y"]].values
            return xy
        def hand(kind):
            xy = points(kind)
            return None if len(xy) < 21 or np.isnan(xy).any() else [round(float(v), 4) for v in xy.ravel()]
        pose = points("pose")
        pose = pose[[0, 11, 12]]  # nose, left shoulder, right shoulder
        frames.append({
            "L": hand("left_hand"),
            "R": hand("right_hand"),
            "pose": None if np.isnan(pose).any() else [[round(float(x), 4), round(float(y), 4)] for x, y in pose],
        })
    return frames


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cached-only", action="store_true")
    parser.add_argument("--words", default=str(TOOLS / "word_list.txt"))
    parser.add_argument("--examples", type=int, default=EXAMPLES_PER_WORD)
    parser.add_argument("--holdout", type=int, default=HOLDOUT_PER_WORD)
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    words = [w.strip() for w in open(args.words) if w.strip() and not w.startswith("#")]
    index_path = CACHE / "train.csv"
    if not index_path.exists():
        CACHE.mkdir(exist_ok=True)
        index_path.write_bytes(download("train.csv"))
    rows = [r for r in csv.DictReader(open(index_path)) if r["sign"] in words]
    missing = set(words) - {r["sign"] for r in rows}
    if missing:
        sys.exit(f"Not in the dataset: {', '.join(sorted(missing))}")

    random.seed(RANDOM_SEED)
    signers = sorted({r["participant_id"] for r in rows})
    holdout_signers = set(random.sample(signers, HOLDOUT_SIGNERS))

    picks = {"examples": [], "holdout": []}
    for word in words:
        word_rows = [r for r in rows if r["sign"] == word]
        by_signer = collections.defaultdict(list)
        for r in word_rows:
            if r["participant_id"] not in holdout_signers:
                by_signer[r["participant_id"]].append(r)
        for recs in by_signer.values():
            random.shuffle(recs)
        chosen = []  # take one per signer in turn, so examples cover many people
        while len(chosen) < args.examples and any(by_signer.values()):
            for signer in sorted(by_signer):
                if by_signer[signer] and len(chosen) < args.examples:
                    chosen.append(by_signer[signer].pop())
        holdout = [r for r in word_rows if r["participant_id"] in holdout_signers]
        random.shuffle(holdout)
        picks["examples"] += chosen
        picks["holdout"] += holdout[:args.holdout]

    if args.cached_only:
        is_cached = lambda r: (CACHE / "files" / r["path"].replace("/", "_")).exists()
        for name in picks:
            before = len(picks[name])
            picks[name] = [r for r in picks[name] if is_cached(r)]
            print(f"{name}: using {len(picks[name])} of {before} (others not downloaded yet)")

    # Download everything first. Order: the 1st example of every word, then the 2nd of
    # every word, and so on (then the test recordings the same way), so if downloading is
    # interrupted every word has about the same number of examples.
    def interleaved(chosen):
        by_word = collections.defaultdict(list)
        for r in chosen:
            by_word[r["sign"]].append(r)
        rounds = max((len(v) for v in by_word.values()), default=0)
        return [v[i] for i in range(rounds) for v in by_word.values() if i < len(v)]
    needed = [r["path"] for chosen in picks.values() for r in interleaved(chosen)]
    needed = [p for p in needed if not (CACHE / "files" / p.replace("/", "_")).exists()]
    print(f"{len(needed)} files to download", flush=True)
    with ThreadPoolExecutor(max_workers=1) as pool:
        for i, _ in enumerate(pool.map(cached, needed), 1):
            if i % 100 == 0 or i == len(needed):
                print(f"downloaded {i}/{len(needed)}", flush=True)

    for name, chosen in picks.items():
        out = []
        for i, r in enumerate(chosen, 1):
            if i % 50 == 0 or i == len(chosen):
                print(f"{name}: {i}/{len(chosen)}", flush=True)
            out.append({"word": r["sign"], "signer": r["participant_id"], "frames": read_recording(cached(r["path"]))})

        file_name = f"{args.out}-{name}.json" if args.out else f"{name}.json"
        (CACHE / file_name).write_text(json.dumps(out, separators=(",", ":")))


if __name__ == "__main__":
    main()
