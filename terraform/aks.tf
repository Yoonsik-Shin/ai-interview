# ⚓ Azure Kubernetes Service (AKS) 프로비저닝 부

# 1. AKS 클러스터부 (신규 생성 분기)
resource "azurerm_kubernetes_cluster" "aks" {
  count               = var.create_aks ? 1 : 0
  name                = var.aks_cluster_name
  location            = local.rg_location
  resource_group_name = local.rg_name
  dns_prefix          = "${var.aks_cluster_name}-dns"

  kubernetes_version  = "1.33.7"

  default_node_pool {
    name       = "systempool"
    node_count = 1
    vm_size    = "Standard_D2as_v5"
  }

  identity {
    type = "SystemAssigned"
  }
}

# 2. AKS 클러스터부 (기존 자원 읽기 분기)
data "azurerm_kubernetes_cluster" "aks" {
  count               = var.create_aks ? 0 : 1
  name                = var.aks_cluster_name
  resource_group_name = local.rg_name
}

# 🔗 아동/종속 리소스 매핑용 동적 지역 변수
locals {
  aks_id       = var.create_aks ? azurerm_kubernetes_cluster.aks[0].id : data.azurerm_kubernetes_cluster.aks[0].id
  aks_identity = var.create_aks ? azurerm_kubernetes_cluster.aks[0].kubelet_identity[0].object_id : data.azurerm_kubernetes_cluster.aks[0].kubelet_identity[0].object_id
}

# 🏭 신규 클러스터 생성 시에만 노드 풀 추가 분산 가동
resource "azurerm_kubernetes_cluster_node_pool" "apppool" {
  count                 = var.create_aks ? 1 : 0
  name                  = "apppool"
  kubernetes_cluster_id = local.aks_id
  vm_size               = "Standard_B2ms"
  node_count            = 2
  node_labels           = { role = "app" }
}

resource "azurerm_kubernetes_cluster_node_pool" "gpupool" {
  count                 = var.create_aks ? 1 : 0
  name                  = "gpupool"
  kubernetes_cluster_id = local.aks_id
  vm_size               = "Standard_NC4as_T4_v3"
  node_count            = 1
  node_labels           = { role = "inference" }
  spot_max_price        = -1
  eviction_policy       = "Deallocate"
}
