import json
from pathlib import Path

import torch
import torch.nn as nn


class VitalCareV2(nn.Module):
    def __init__(
        self,
        num_classes=10,
        input_features=51,
        sequence_length=16,
        d_model=128,
        transformer_layers=2,
        attention_heads=4,
        feedforward_dim=256,
    ):
        super().__init__()

        self.input_projection = nn.Linear(input_features, d_model)

        self.tcn = nn.Sequential(
            nn.Conv1d(d_model, d_model, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(d_model, d_model, kernel_size=3, padding=2, dilation=2),
            nn.ReLU(),
        )

        self.position = nn.Parameter(
            torch.zeros(1, sequence_length, d_model)
        )

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=attention_heads,
            dim_feedforward=feedforward_dim,
            dropout=0.2,
            activation="gelu",
            batch_first=True,
        )

        self.transformer = nn.TransformerEncoder(
            encoder_layer,
            num_layers=transformer_layers,
        )

        self.classifier = nn.Sequential(
            nn.LayerNorm(d_model),
            nn.Linear(d_model, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes),
        )

    def forward(self, x):
        x = self.input_projection(x)
        x = self.tcn(x.transpose(1, 2)).transpose(1, 2)
        x = x + self.position
        x = self.transformer(x)
        x = x.mean(dim=1)
        return self.classifier(x)


def load_v2_model(model_dir=None, device="cpu"):
    model_dir = Path(model_dir or Path(__file__).parent / "models")

    with (model_dir / "model_metadata.json").open(
        "r", encoding="utf-8"
    ) as f:
        metadata = json.load(f)

    model = VitalCareV2(
        num_classes=len(metadata["classes"]),
        input_features=metadata["features_per_frame"],
        sequence_length=metadata["input_shape"][0],
        d_model=metadata["d_model"],
        transformer_layers=metadata["transformer_layers"],
        attention_heads=metadata["attention_heads"],
        feedforward_dim=metadata["feedforward_dim"],
    )

    checkpoint = torch.load(
        model_dir / "tcn_transformer_10class_best.pth",
        map_location=device,
        weights_only=True,
    )

    model.load_state_dict(checkpoint, strict=True)
    model.to(device)
    model.eval()

    return model, metadata
