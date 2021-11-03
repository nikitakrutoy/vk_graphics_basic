#include "scan_compute.h"
#include "renderdoc_app.h"
#include "../resources/shaders/common.h"
#include <windows.h>

int main()
{
    constexpr int LENGTH = GRID_SIZE;
    constexpr int VULKAN_DEVICE_ID = 0;

    std::shared_ptr<ICompute> app = std::make_unique<ScanCompute>(LENGTH);
    if (app == nullptr)
    {
        std::cout << "Can't create render of specified type" << std::endl;
        return 1;
    }
    RENDERDOC_API_1_1_2* rdoc_api = NULL;

    // At init, on windows
    if (HMODULE mod = GetModuleHandleA("renderdoc.dll"))
    {
        pRENDERDOC_GetAPI RENDERDOC_GetAPI =
            (pRENDERDOC_GetAPI)GetProcAddress(mod, "RENDERDOC_GetAPI");
        int ret = RENDERDOC_GetAPI(eRENDERDOC_API_Version_1_1_2, (void**)&rdoc_api);
        assert(ret == 1);
    }

    if (rdoc_api) rdoc_api->StartFrameCapture(NULL, NULL);

    // Your rendering should happen here
    app->InitVulkan(nullptr, 0, VULKAN_DEVICE_ID);
    app->Execute();
    // stop the capture

    if (rdoc_api) {
        rdoc_api->EndFrameCapture(NULL, NULL);
    }

    return 0;
}
