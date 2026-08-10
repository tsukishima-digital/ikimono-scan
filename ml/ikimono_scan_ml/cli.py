from __future__ import annotations

import argparse
import json


def main() -> None:
    parser = argparse.ArgumentParser(description="生き物スキャン ML utilities")
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch_parser = subparsers.add_parser("fetch-inat")
    fetch_parser.add_argument("--config", required=True)

    train_parser = subparsers.add_parser("train")
    train_parser.add_argument("--config", required=True)

    eval_parser = subparsers.add_parser("evaluate")
    eval_parser.add_argument("--checkpoint", required=True)
    eval_parser.add_argument("--data-dir", required=True)

    args = parser.parse_args()
    if args.command == "fetch-inat":
        from ikimono_scan_ml.inat import fetch_dataset

        fetch_dataset(args.config)
    elif args.command == "train":
        from ikimono_scan_ml.training import train_from_config

        artifacts = train_from_config(args.config)
        print(json.dumps({key: str(value) for key, value in artifacts.__dict__.items()}, indent=2))
    elif args.command == "evaluate":
        from ikimono_scan_ml.training import evaluate_checkpoint

        metrics = evaluate_checkpoint(args.checkpoint, args.data_dir)
        print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
