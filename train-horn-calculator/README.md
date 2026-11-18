# train-horn-calculator

A small, self-hosted **train horn loudness-at-distance calculator** for Kubernetes. It estimates the sound level at a listener from a horn's rated level at a reference distance, using the inverse-square law (−6.02 dB per doubling of distance), with an optional air-absorption term.

The static web app (HTML, CSS and vanilla JS, no external requests) is stored in a ConfigMap and served by unprivileged nginx with a read-only root filesystem. It is a self-hosted copy of a tool from the [Train Horn calculators](https://train-horn.com/tools/) collection, an independent US reference on train horns.

## What the calculator does

- Inputs: source level (dB), reference distance, listener distance, feet or metres.
- Labels where the source number comes from: manufacturer claim, independent measurement or statutory limit.
- Output: level at the listener, a comparison scale (conversation, traffic, OSHA 85/90 dBA, threshold of pain) and a table of the same horn at other distances.
- Formula: `L2 = L1 − 20·log10(r2 / r1) [− α·(r2 − r1)]`, free field, point source. It is an estimate, not a safety or legal determination.

The math is covered by unit tests (`node test.js` in the source project, 10/10 passing).

## Install

```bash
helm repo add train-horn https://train-horn.github.io/helm-charts/
helm repo update
helm install horn-calc train-horn/train-horn-calculator
kubectl port-forward svc/horn-calc-train-horn-calculator 8080:80
# open http://127.0.0.1:8080/
```

With an Ingress:

```bash
helm install horn-calc train-horn/train-horn-calculator \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=horn-calc.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

Uninstall: `helm uninstall horn-calc`.

## Security defaults

- Runs as UID/GID 101 (`runAsNonRoot`), `readOnlyRootFilesystem: true`, all capabilities dropped, no privilege escalation, `RuntimeDefault` seccomp profile.
- nginx writes only to a size-limited `/tmp` emptyDir.
- No service account token is mounted.
- Strict Content-Security-Policy (`default-src 'self'`); the page loads nothing from third parties.
- `/healthz` endpoint for liveness and readiness probes.
- Pods restart automatically when the ConfigMap content changes (checksum annotation).

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `replicaCount` | int | `1` | Number of nginx pods |
| `image.repository` | string | `nginxinc/nginx-unprivileged` | Container image (must run as non-root) |
| `image.tag` | string | `1.27-alpine` | Image tag |
| `image.pullPolicy` | string | `IfNotPresent` | Image pull policy |
| `imagePullSecrets` | list | `[]` | Image pull secrets |
| `nameOverride` | string | `""` | Override the chart name |
| `fullnameOverride` | string | `""` | Override the full resource name |
| `containerPort` | int | `8080` | Port nginx listens on in the container |
| `podAnnotations` | object | `{}` | Extra pod annotations |
| `podLabels` | object | `{}` | Extra pod labels |
| `podSecurityContext` | object | non-root 101, RuntimeDefault seccomp | Pod security context |
| `securityContext` | object | read-only root FS, drop ALL | Container security context |
| `service.type` | string | `ClusterIP` | Service type |
| `service.port` | int | `80` | Service port |
| `ingress.enabled` | bool | `false` | Create an Ingress |
| `ingress.className` | string | `""` | IngressClass name |
| `ingress.annotations` | object | `{}` | Ingress annotations |
| `ingress.hosts` | list | `horn-calc.local` `/` | Hosts and paths |
| `ingress.tls` | list | `[]` | TLS configuration |
| `resources` | object | 10m/16Mi requests, 100m/64Mi limits | CPU and memory |
| `tmpSizeLimit` | string | `16Mi` | Size limit of the `/tmp` emptyDir |
| `nodeSelector` | object | `{}` | Node selector |
| `tolerations` | list | `[]` | Tolerations |
| `affinity` | object | `{}` | Affinity rules |

## Customizing the site

The served files are in the chart's `files/` directory (`index.html`, `style.css`, `script.js`). Every file there becomes a key in the site ConfigMap, so you can fork the chart and edit or add files.

## Links

- More calculators (air tank runtime, battery drain, compressor recovery, PSI to loudness): https://train-horn.com/tools/
- Original decibel distance calculator: https://train-horn.com/tools/decibel-distance/
- Chart source: https://github.com/train-horn/helm-charts

## License

MIT. See `LICENSE`.
