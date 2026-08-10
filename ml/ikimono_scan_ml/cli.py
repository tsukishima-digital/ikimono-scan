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

    export_parser = subparsers.add_parser("export-web")
    export_parser.add_argument("--checkpoint", required=True)
    export_parser.add_argument("--output-dir", required=True)
    export_parser.add_argument("--version", required=True)
    export_parser.add_argument("--license", required=True, dest="license_name")
    export_parser.add_argument("--source", required=True)
    export_parser.add_argument(
        "--taxonomy-catalog",
        default="ml/taxonomy/ja.json",
    )

    taxonomy_parser = subparsers.add_parser("refresh-taxonomy-ja")
    taxonomy_parser.add_argument("--checkpoint", required=True)
    taxonomy_parser.add_argument("--output", default="ml/taxonomy/ja.json")

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
    elif args.command == "export-web":
        from ikimono_scan_ml.web_export import export_checkpoint

        artifacts = export_checkpoint(
            checkpoint_path=args.checkpoint,
            output_dir=args.output_dir,
            version=args.version,
            license_name=args.license_name,
            source=args.source,
            taxonomy_catalog_path=args.taxonomy_catalog,
        )
        print(json.dumps({key: str(value) for key, value in artifacts.__dict__.items()}, indent=2))
    elif args.command == "refresh-taxonomy-ja":
        from ikimono_scan_ml.taxonomy import refresh_japanese_catalog

        output_path = refresh_japanese_catalog(
            checkpoint_path=args.checkpoint,
            output_path=args.output,
        )
        print(output_path)


if __name__ == "__main__":
    main()
