# 🚢 Terraform Providers 강제 버전 고정 (멱등성 확보용)

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "4.65.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12.0" # 👈 전 세계 표준 호환 버전인 2.x 로 고정합니다!
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24.0"
    }
  }
}

provider "kubernetes" {
  host                   = var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.host : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.host
  client_certificate     = base64decode(var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.client_certificate : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.client_certificate)
  client_key             = base64decode(var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.client_key : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.client_key)
  cluster_ca_certificate = base64decode(var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.cluster_ca_certificate : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.host : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.host
    client_certificate     = base64decode(var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.client_certificate : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.client_certificate)
    client_key             = base64decode(var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.client_key : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.client_key)
    cluster_ca_certificate = base64decode(var.create_aks ? azurerm_kubernetes_cluster.aks[0].kube_config.0.cluster_ca_certificate : data.azurerm_kubernetes_cluster.aks[0].kube_config.0.cluster_ca_certificate)
  }
}

# 🛡️ Azure Key Vault (보안 시크릿 저장소)


data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  name                        = "unbrdn-keyvault" # 전역 고유한 이름으로 지정 권장
  location                    = "Korea Central"
  resource_group_name         = local.rg_name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"

  # 백업 보존 및 삭제 방지 안전 잠금장치
  purge_protection_enabled    = false
  soft_delete_retention_days = 7

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Set",
      "Get",
      "List",
      "Delete",
      "Purge",
      "Recover"
    ]
  }
}

# AKS Kubelet Managed Identity → Key Vault 읽기 권한
# ESO(External Secrets Operator)가 노드 관리 ID로 Key Vault에 접근
resource "azurerm_key_vault_access_policy" "aks_kubelet" {
  key_vault_id = azurerm_key_vault.kv.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = local.aks_identity

  secret_permissions = ["Get", "List"]
}

# 🛠️ External Secrets Operator (파드가 Key Vault 시크릿 연동)
resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  namespace  = "external-secrets"
  create_namespace = true

  # 구형/특정 플러그인 호환성을 위해 values 방식을 사용합니다.
  values = [
    yamlencode({
      installCRDs = true
    })
  ]
}
