# 📦 Azure Container Registry (ACR) 및 AcrPull 권한 연동

resource "azurerm_container_registry" "acr" {
  name                = "unbrdnacr"
  resource_group_name = data.azurerm_resource_group.unbrdn.name
  location            = data.azurerm_resource_group.unbrdn.location
  sku                 = "Standard"
  admin_enabled       = true
}

resource "azurerm_role_assignment" "aks_to_acr" {
  principal_id                     = data.azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.acr.id
  skip_service_principal_aad_check = true
}
