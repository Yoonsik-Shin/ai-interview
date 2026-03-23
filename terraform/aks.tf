# ⚓ Azure Kubernetes Service (AKS) 프로비저닝

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "unbrdn-aks"
  location            = azurerm_resource_group.unbrdn.location
  resource_group_name = azurerm_resource_group.unbrdn.name
  dns_prefix          = "unbrdn-aks-dns"
  kubernetes_version  = "1.33.7"

  # 1) System Node Pool
  default_node_pool {
    name           = "systempool"
    node_count     = 1
    vm_size        = "Standard_D2as_v5"
    vnet_subnet_id = azurerm_subnet.aks_subnet.id
  }

  identity {
    type = "SystemAssigned"
  }
}

# 2) App Node Pool (Standard_B2ms x 2)
resource "azurerm_kubernetes_cluster_node_pool" "apppool" {
  name                  = "apppool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id
  vm_size               = "Standard_B2ms"
  node_count            = 2
  vnet_subnet_id        = azurerm_subnet.aks_subnet.id
  node_labels           = { role = "app" }
}

# 3) GPU Node Pool (Standard_NC4as_T4_v3)
resource "azurerm_kubernetes_cluster_node_pool" "gpupool" {
  name                  = "gpupool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id
  vm_size               = "Standard_NC4as_T4_v3"
  node_count            = 1
  vnet_subnet_id        = azurerm_subnet.aks_subnet.id
  node_labels           = { role = "inference" }
  spot_max_price        = -1 # 스팟 인스턴스 전가로 비용 아낌
  eviction_policy       = "Deallocate"
}
