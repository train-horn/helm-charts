# Train Horn Helm charts

Helm chart repository served by GitHub Pages.

```bash
helm repo add train-horn https://train-horn.github.io/helm-charts/
helm install horn-calc train-horn/train-horn-calculator
```

| Chart | Description |
|-------|-------------|
| [train-horn-calculator](train-horn-calculator/) | Self-hosted train horn loudness-at-distance (dB) calculator on unprivileged nginx |

Chart sources are in [`train-horn-calculator/`](train-horn-calculator/). The packaged chart and `index.yaml` are at the repository root.

From [Train Horn](https://train-horn.com/tools/), an independent US reference on train horns. MIT License.
