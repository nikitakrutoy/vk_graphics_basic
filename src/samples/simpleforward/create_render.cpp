#include "render/render_common.h"
#include "create_render.h"
#include "simple_render.h"
#include "simple_render_tex.h"


std::unique_ptr<IRender> CreateRender(uint32_t w, uint32_t h, RenderEngineType type, bool debugNormals)
{
  switch(type)
  {
  case RenderEngineType::SIMPLE_FORWARD:
  {
    auto r = std::make_unique<SimpleRender>(w, h);
    r->bDebugNormals = debugNormals;
    return r;
  }
  case RenderEngineType::SIMPLE_TEXTURE:
    return std::make_unique<SimpleRenderTexture>(w, h);

  default:
    return nullptr;
  }
}


