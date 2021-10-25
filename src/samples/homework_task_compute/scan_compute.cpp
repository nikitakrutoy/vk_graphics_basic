#include "scan_compute.h"

#include <vk_pipeline.h>
#include <vk_buffers.h>
#include <vk_utils.h>

ScanCompute::ScanCompute(uint32_t a_length) : m_length(a_length)
{
#ifdef NDEBUG
    m_enableValidation = false;
#else
    m_enableValidation = true;
#endif
}

void ScanCompute::SetupValidationLayers()
{
    m_validationLayers.push_back("VK_LAYER_KHRONOS_validation");
    m_validationLayers.push_back("VK_LAYER_LUNARG_monitor");
}

void ScanCompute::InitVulkan(const char** a_instanceExtensions, uint32_t a_instanceExtensionsCount, uint32_t a_deviceId)
{
    m_instanceExtensions.clear();
    for (uint32_t i = 0; i < a_instanceExtensionsCount; ++i) {
        m_instanceExtensions.push_back(a_instanceExtensions[i]);
    }
    SetupValidationLayers();
    VK_CHECK_RESULT(volkInitialize());
    CreateInstance();
    volkLoadInstance(m_instance);

    CreateDevice(a_deviceId);
    volkLoadDevice(m_device);

    m_commandPool = vk_utils::createCommandPool(m_device, m_queueFamilyIDXs.compute, VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT);

    m_cmdBufferCompute = vk_utils::createCommandBuffers(m_device, m_commandPool, 1)[0];

    m_pCopyHelper = std::make_shared<vk_utils::SimpleCopyHelper>(m_physicalDevice, m_device, m_transferQueue, m_queueFamilyIDXs.compute, 8 * 1024 * 1024);
}


void ScanCompute::CreateInstance()
{
    VkApplicationInfo appInfo = {};
    appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
    appInfo.pNext = nullptr;
    appInfo.pApplicationName = "VkRender";
    appInfo.applicationVersion = VK_MAKE_VERSION(0, 1, 0);
    appInfo.pEngineName = "ScanCompute";
    appInfo.engineVersion = VK_MAKE_VERSION(0, 1, 0);
    appInfo.apiVersion = VK_MAKE_VERSION(1, 1, 0);

    m_instance = vk_utils::createInstance(m_enableValidation, m_validationLayers, m_instanceExtensions, &appInfo);
    if (m_enableValidation)
        vk_utils::initDebugReportCallback(m_instance, &debugReportCallbackFn, &m_debugReportCallback);
}

void ScanCompute::CreateDevice(uint32_t a_deviceId)
{
    m_physicalDevice = vk_utils::findPhysicalDevice(m_instance, true, a_deviceId, m_deviceExtensions);

    m_device = vk_utils::createLogicalDevice(m_physicalDevice, m_validationLayers, m_deviceExtensions,
        m_enabledDeviceFeatures, m_queueFamilyIDXs,
        VK_QUEUE_COMPUTE_BIT | VK_QUEUE_TRANSFER_BIT);

    vkGetDeviceQueue(m_device, m_queueFamilyIDXs.compute, 0, &m_computeQueue);
    vkGetDeviceQueue(m_device, m_queueFamilyIDXs.transfer, 0, &m_transferQueue);
}


void ScanCompute::SetupSimplePipeline()
{
    std::vector<std::pair<VkDescriptorType, uint32_t> > dtypes = {
        {VK_DESCRIPTOR_TYPE_STORAGE_BUFFER,             8}
    };

    // Создание и аллокация буферов

    //m_input = vk_utils::createBuffer(m_device, sizeof(float) * m_length * m_length, VK_BUFFER_USAGE_STORAGE_BUFFER_BIT);
    //m_result = vk_utils::createBuffer(m_device, sizeof(float) * m_length * m_length, VK_BUFFER_USAGE_STORAGE_BUFFER_BIT)
    //m_sums = vk_utils::createBuffer(m_device, sizeof(float) * m_length , VK_BUFFER_USAGE_STORAGE_BUFFER_BIT)
    m_A = vk_utils::createBuffer(m_device, sizeof(float) * m_length * m_length, VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | VK_BUFFER_USAGE_TRANSFER_DST_BIT);
    m_sum = vk_utils::createBuffer(m_device, sizeof(float) * m_length * m_length, VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | VK_BUFFER_USAGE_TRANSFER_SRC_BIT);
    m_B = vk_utils::createBuffer(m_device, sizeof(float) * m_length, VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | VK_BUFFER_USAGE_TRANSFER_SRC_BIT);
    m_C = vk_utils::createBuffer(m_device, sizeof(float) * m_length, VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | VK_BUFFER_USAGE_TRANSFER_SRC_BIT | VK_BUFFER_USAGE_TRANSFER_DST_BIT);
    vk_utils::allocateAndBindWithPadding(m_device, m_physicalDevice, { m_A, m_sum, m_B, m_C }, 0);

    m_pBindings = std::make_shared<vk_utils::DescriptorMaker>(m_device, dtypes, 3);

    // Создание descriptor set для передачи буферов в шейдер
    m_pBindings->BindBegin(VK_SHADER_STAGE_COMPUTE_BIT);
    m_pBindings->BindBuffer(0, m_A);
    m_pBindings->BindBuffer(1, m_sum);
    m_pBindings->BindBuffer(2, m_B);
    m_pBindings->BindEnd(&m_sumDS, &m_sumDSLayout);

    m_pBindings->BindBegin(VK_SHADER_STAGE_COMPUTE_BIT);
    m_pBindings->BindBuffer(0, m_B);
    m_pBindings->BindBuffer(1, m_C);
    m_pBindings->BindBuffer(2, m_A);
    m_pBindings->BindEnd(&m_sumDS2, &m_sumDSLayout);


    m_pBindings->BindBegin(VK_SHADER_STAGE_COMPUTE_BIT);
    m_pBindings->BindBuffer(0, m_sum);
    m_pBindings->BindBuffer(1, m_C);
    m_pBindings->BindEnd(&m_addDS, &m_addDSLayout);
    // Заполнение буферов
    std::vector<float> values(m_length * m_length);
    for (uint32_t i = 0; i < m_length; ++i) {
        for (uint32_t j = 0; j < m_length; ++j) {
            values[i * m_length + j] = j + i;
        }
    }
    m_pCopyHelper->UpdateBuffer(m_A, 0, values.data(), sizeof(float) * values.size());


    std::vector<float> valuesC(m_length);

    for (uint32_t j = 0; j < m_length; ++j) {
        valuesC[j] = 2;
    }

    m_pCopyHelper->UpdateBuffer(m_C, 0, valuesC.data(), sizeof(float) * valuesC.size());
}

void ScanCompute::BuildCommandBufferSimple(VkCommandBuffer a_cmdBuff, VkPipeline a_pipeline)
{
    vkResetCommandBuffer(a_cmdBuff, 0);

    VkCommandBufferBeginInfo beginInfo = {};
    beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
    beginInfo.flags = VK_COMMAND_BUFFER_USAGE_SIMULTANEOUS_USE_BIT;

    // Заполняем буфер команд
    VK_CHECK_RESULT(vkBeginCommandBuffer(a_cmdBuff, &beginInfo));

    vkCmdBindPipeline(a_cmdBuff, VK_PIPELINE_BIND_POINT_COMPUTE, m_pipeline);
    vkCmdBindDescriptorSets(a_cmdBuff, VK_PIPELINE_BIND_POINT_COMPUTE, m_layout, 0, 1, &m_sumDS, 0, NULL);
    vkCmdPushConstants(a_cmdBuff, m_layout, VK_SHADER_STAGE_COMPUTE_BIT, 0, sizeof(m_length), &m_length);
    vkCmdDispatch(a_cmdBuff, m_length, 1, 1);

    VkBufferMemoryBarrier barrier = {};
    barrier.sType = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER;
    barrier.pNext = nullptr;
    barrier.srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
    barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
    barrier.buffer = m_B;
    barrier.offset = 0;
    barrier.size = VK_WHOLE_SIZE;
    vkCmdPipelineBarrier(a_cmdBuff, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, {}, 0, nullptr, 1, &barrier, 0, nullptr);

    vkCmdBindDescriptorSets(a_cmdBuff, VK_PIPELINE_BIND_POINT_COMPUTE, m_layout, 0, 1, &m_sumDS2, 0, NULL);
    vkCmdPushConstants(a_cmdBuff, m_layout, VK_SHADER_STAGE_COMPUTE_BIT, 0, sizeof(m_length), &m_length);
    vkCmdDispatch(a_cmdBuff, 1, 1, 1);

    VkBufferMemoryBarrier barrier2 = {};
    barrier.sType = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER;
    barrier.pNext = nullptr;
    barrier.srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
    barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
    barrier.buffer = m_C;
    barrier.offset = 0;
    barrier.size = VK_WHOLE_SIZE;
    vkCmdPipelineBarrier(a_cmdBuff, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, {}, 0, nullptr, 1, &barrier2, 0, nullptr);

    vkCmdBindPipeline(a_cmdBuff, VK_PIPELINE_BIND_POINT_COMPUTE, m_pipeline2);
    vkCmdBindDescriptorSets(a_cmdBuff, VK_PIPELINE_BIND_POINT_COMPUTE, m_layout2, 0, 1, &m_addDS, 0, NULL);
    vkCmdPushConstants(a_cmdBuff, m_layout2, VK_SHADER_STAGE_COMPUTE_BIT, 0, sizeof(m_length), &m_length);
    vkCmdDispatch(a_cmdBuff, m_length, 1, 1);

    VK_CHECK_RESULT(vkEndCommandBuffer(a_cmdBuff));
}


void ScanCompute::CleanupPipeline()
{
    if (m_cmdBufferCompute)
    {
        vkFreeCommandBuffers(m_device, m_commandPool, 1, &m_cmdBufferCompute);
    }

    vkDestroyBuffer(m_device, m_A, nullptr);
    vkDestroyBuffer(m_device, m_B, nullptr);
    vkDestroyBuffer(m_device, m_C, nullptr);
    vkDestroyBuffer(m_device, m_sum, nullptr);

    vkDestroyPipelineLayout(m_device, m_layout, nullptr);
    vkDestroyPipeline(m_device, m_pipeline, nullptr);

    vkDestroyPipelineLayout(m_device, m_layout2, nullptr);
    vkDestroyPipeline(m_device, m_pipeline2, nullptr);
}


void ScanCompute::Cleanup()
{
    CleanupPipeline();

    if (m_commandPool != VK_NULL_HANDLE)
    {
        vkDestroyCommandPool(m_device, m_commandPool, nullptr);
    }
}


void ScanCompute::CreateComputePipeline(std::string shaderPath, VkPipeline& a_pipeline, VkPipelineLayout& a_layout, VkDescriptorSetLayout& a_dsLayout)
{
    // Загружаем шейдер
    std::vector<uint32_t> code = vk_utils::readSPVFile(shaderPath.c_str());
    VkShaderModuleCreateInfo createInfo = {};
    createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
    createInfo.pCode = code.data();
    createInfo.codeSize = code.size() * sizeof(uint32_t);

    VkShaderModule shaderModule;
    // Создаём шейдер в вулкане
    VK_CHECK_RESULT(vkCreateShaderModule(m_device, &createInfo, NULL, &shaderModule));

    VkPipelineShaderStageCreateInfo shaderStageCreateInfo = {};
    shaderStageCreateInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    shaderStageCreateInfo.stage = VK_SHADER_STAGE_COMPUTE_BIT;
    shaderStageCreateInfo.module = shaderModule;
    shaderStageCreateInfo.pName = "main";

    VkPushConstantRange pcRange = {};
    pcRange.offset = 0;
    pcRange.size = sizeof(m_length);
    pcRange.stageFlags = VK_SHADER_STAGE_COMPUTE_BIT;

    // Создаём layout для pipeline
    VkPipelineLayoutCreateInfo pipelineLayoutCreateInfo = {};
    pipelineLayoutCreateInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
    pipelineLayoutCreateInfo.setLayoutCount = 1;
    pipelineLayoutCreateInfo.pSetLayouts = &a_dsLayout;
    pipelineLayoutCreateInfo.pushConstantRangeCount = 1;
    pipelineLayoutCreateInfo.pPushConstantRanges = &pcRange;
    VK_CHECK_RESULT(vkCreatePipelineLayout(m_device, &pipelineLayoutCreateInfo, NULL, &a_layout));

    VkComputePipelineCreateInfo pipelineCreateInfo = {};
    pipelineCreateInfo.sType = VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO;
    pipelineCreateInfo.stage = shaderStageCreateInfo;
    pipelineCreateInfo.layout = a_layout;

    // Создаём pipeline - объект, который выставляет шейдер и его параметры
    VK_CHECK_RESULT(vkCreateComputePipelines(m_device, VK_NULL_HANDLE, 1, &pipelineCreateInfo, NULL, &a_pipeline));

    vkDestroyShaderModule(m_device, shaderModule, nullptr);
}


void ScanCompute::Execute()
{
    SetupSimplePipeline();
    CreateComputePipeline("../resources/shaders/scan.comp.spv", m_pipeline, m_layout, m_sumDSLayout);
    CreateComputePipeline("../resources/shaders/add.comp.spv", m_pipeline2, m_layout2, m_addDSLayout);

    BuildCommandBufferSimple(m_cmdBufferCompute, nullptr);

    VkSubmitInfo submitInfo = {};
    submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;
    submitInfo.commandBufferCount = 1;
    submitInfo.pCommandBuffers = &m_cmdBufferCompute;

    VkFenceCreateInfo fenceCreateInfo = {};
    fenceCreateInfo.sType = VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;
    fenceCreateInfo.flags = 0;
    VK_CHECK_RESULT(vkCreateFence(m_device, &fenceCreateInfo, NULL, &m_fence));


    std::vector<float> values3(m_length);
    m_pCopyHelper->ReadBuffer(m_C, 0, values3.data(), sizeof(float) * values3.size());
    for (uint32_t j = 0; j < m_length; ++j) {
        std::cout << values3[j] << " ";
    }
    std::cout << std::endl;


    // Отправляем буфер команд на выполнение
    VK_CHECK_RESULT(vkQueueSubmit(m_computeQueue, 1, &submitInfo, m_fence));

    //Ждём конца выполнения команд
    VK_CHECK_RESULT(vkWaitForFences(m_device, 1, &m_fence, VK_TRUE, 100000000000));

    std::vector<float> values(m_length * m_length);
    m_pCopyHelper->ReadBuffer(m_sum, 0, values.data(), sizeof(float) * values.size());
    for (uint32_t i = 0; i < m_length; ++i) {
        for (uint32_t j = 0; j < m_length; ++j) {
            std::cout << values[i * m_length + j] << " ";
        }
        std::cout << std::endl;
    }

    std::vector<float> values2(m_length);
    m_pCopyHelper->ReadBuffer(m_B, 0, values2.data(), sizeof(float) * values2.size());
    for (uint32_t j = 0; j < m_length; ++j) {
        std::cout << values2[j] << " ";
    }
    std::cout << std::endl;
    m_pCopyHelper->ReadBuffer(m_C, 0, values3.data(), sizeof(float) * values3.size());
    for (uint32_t j = 0; j < m_length; ++j) {
        std::cout << values3[j] << " ";
    }
    std::cout << std::endl;
}
