# ⚓ 기존 AKS 클러스터 로드

data "azurerm_kubernetes_cluster" "aks" {
  name                = "unbrdn-aks"
  resource_group_name = data.azurerm_resource_group.unbrdn.name
}

# 1) App Node Pool (Standard_B2ms x 2)
resource "azurerm_kubernetes_cluster_node_pool" "apppool" {
  name                  = "apppool"
  kubernetes_cluster_id = data.azurerm_kubernetes_cluster.aks.id
  vm_size               = "Standard_B2ms"
  node_count            = 2
  node_labels           = { role = "app" }
}

# 2) GPU Node Pool (Standard_NC4as_T4_v3)
resource "azurerm_kubernetes_cluster_node_pool" "gpupool" {
  name                  = "gpupool"
  kubernetes_cluster_id = data.azurerm_kubernetes_cluster.aks.id
  vm_size               = "Standard_NC4as_T4_v3"
  node_count            = 1
  node_labels           = { role = "inference" }
  spot_max_price        = -1 # 스팟 인스턴스 가동비 절약
  eviction_policy       = "Deallocate"
}
