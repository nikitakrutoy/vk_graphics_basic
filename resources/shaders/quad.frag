#version 450
#extension GL_ARB_separate_shader_objects : enable
#pragma dfull

layout(location = 0) out vec4 color;

// layout (binding = 0) uniform sampler2D colorTex;
layout (binding = 1) uniform sampler2D sdfTex;

layout (location = 0 ) in VS_OUT
{
  vec2 texCoord;
} surf;

layout(push_constant) uniform params_t
{
    float rotX;
    float rotY;
    int draw_depth;
    vec3 translate;
} params;

// layout(std430, binding = 1) buffer sdf 
// {
//     float SDF[];
// };


int getindex(int x, int y, int z) {
  return z * 64 * 64 + y * 64 + x;
}

float width = 64;
float height = 64;
float depth = 32;
float scale = 1.0 / 20.0;

float textureWidth = 64;
float textureHeight = 3584;

// float getdist(vec3 p) {
//   vec3 biased = p / scale + vec3(width, depth, height) / 2.0;
//   int index = getindex(int(floor(biased.x)), int(floor(biased.z)), int(floor(biased.y)));
//   if (index < 64 * 64 * 32 && index > 0)
//     return SDF[index];
//   else
//     return 1; 
// }

float PI = 3.14;

mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(1, 0, 0),
        vec3(0, c, -s),
        vec3(0, s, c)
    );
}

mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(c, 0, s),
        vec3(0, 1, 0),
        vec3(-s, 0, c)
    );
}

const float MAX_STORE_DIST = 10;
const float MAX_TRACE_DIST = 50;
const vec3 LIGHT_DIR = normalize(vec3(0.1, -1, -0.2));
const float STEP_SIZE = 0.01;
const int STEP_NUM = 400;
const float THRES = 0.15;

float getdist(vec3 p) {
  p = rotateY(params.rotY / 180.0 * PI) * rotateX(params.rotX / 180.0 * PI) * (p / scale + params.translate);
  vec3 bbox = vec3(width, depth, height);
  vec3 biased = p + bbox / 2.0;
  if (any(greaterThan(biased, bbox - 1)) || any(lessThan(biased, vec3(1)))) {
    return 1;
  }
  biased.y = biased.y - 1;
  int x = int(floor(biased.x));
  int y1 = int(floor(biased.y));
  int y2 = int(ceil(biased.y));
  int z = int((biased.z));
  float y_w = fract(biased.y);
  float u = x / (textureWidth);
  float v1 = (y1  * textureWidth + z) / (textureHeight);
  float v2 = (y2  * textureWidth + z) / (textureHeight);
  float result1 = MAX_STORE_DIST * textureLod(sdfTex, vec2(u, v1), 0).x;
  float result2 = MAX_STORE_DIST * textureLod(sdfTex, vec2(u, v2), 0).x;
  float result = y_w * result1 + (1 - y_w) * result2;
  
  return result;
}

float getdist2(vec3 p) {
  vec3 bbox = vec3(width, depth, height);
  vec3 biased = p + bbox / 2.0;
  if (any(greaterThan(biased, bbox - 1)) || any(lessThan(biased, vec3(1)))) {
    return 1;
  }
  biased.y = biased.y - 1;
  int x = int(floor(biased.x));
  int y1 = int(floor(biased.y));
  int y2 = int(ceil(biased.y));
  int z = int((biased.z));
  float y_w = fract(biased.y);
  float u = x / (textureWidth);
  float v1 = (y1  * textureWidth + z) / (textureHeight);
  float v2 = (y2  * textureWidth + z) / (textureHeight);
  float result1 = MAX_STORE_DIST * textureLod(sdfTex, vec2(u, v1), 0).x;
  float result2 = MAX_STORE_DIST * textureLod(sdfTex, vec2(u, v2), 0).x;
  float result = y_w * result1 + (1 - y_w) * result2;
  
  return result;
}

vec3 getnormal(vec3 p) {
  float delta = 0.1;
  float dist = getdist(p);
  float distX = getdist(p + vec3(delta, 0, 0));
  float distY = getdist(p + vec3(0, delta, 0));
  float distZ = getdist(p + vec3(0, 0, delta));
  float distX2 = getdist(p - vec3(delta, 0, 0));
  float distY2 = getdist(p - vec3(0, delta, 0));
  float distZ2 = getdist(p - vec3(0, 0, delta));
  return normalize(vec3(distX - distX2, distY - distY2, distZ - distZ2) / (2 * delta));
}

vec3 getnormal2(vec3 p) {
  p = rotateY(params.rotY / 180.0 * PI) * rotateX(params.rotX / 180.0 * PI) * (p / scale + params.translate);
  float delta = 0.2;
  float dist = getdist(p);
  float distX = getdist2(p + vec3(delta, 0, 0));
  float distY = getdist2(p + vec3(0, delta, 0));
  float distZ = getdist2(p + vec3(0, 0, delta));
  float distX2 = getdist2(p - vec3(delta, 0, 0));
  float distY2 = getdist2(p - vec3(0, delta, 0));
  float distZ2 = getdist2(p - vec3(0, 0, delta));
  return normalize(vec3(distX - distX2, distY - distY2, distZ - distZ2) / (2 * delta));
}


float trace ( in vec3 from, in vec3 dir, out bool hit, out vec3 normal)
{
	vec3	p         = from;
	float	totalDist = 0.0;

  normal = vec3(-1, -1, -1);
	hit = false;
	
  int stepNum = STEP_NUM;
	for ( int steps = 0; steps < stepNum; steps++ )
	{
    float dist = getdist(p);
    float m = 1;
    if (dist < scale * 2) {
      m = 0.1;
    }
    p += dist * dir * scale / 2; 
    
    float thres;

    if (params.draw_depth == 1) 
      thres = 1;
    else 
      thres = THRES;

		if ( dist < thres )
		{
			hit = true;
      normal = getnormal2(p);
			return totalDist;
		}
		
		totalDist += dist * STEP_SIZE;
		
		if ( totalDist > MAX_TRACE_DIST )
			break;	
	}
	return 0;
}


void main()
{
  vec3 lightPos = vec3(0, -6., 0.);
  vec3 cameraPos = vec3(0., 0.5, 0.);
  vec3 cameraForward = vec3(0., -1, 0.);
  vec3 cameraUp = vec3 (0., 0., 1.);

  vec2 uv = surf.texCoord.xy * 1;
  vec3 from = vec3(uv.x, 0, uv.y);
  vec3 dir = normalize(from - cameraPos);

  bool hit = false;
  vec3 normal;
  float d = trace(cameraPos, dir, hit, normal);
  vec3 light_dir = rotateY(params.rotY / 180.0 * PI) * rotateX(params.rotX / 180.0 * PI) * LIGHT_DIR;
  float lambert = max(0.0, dot(-LIGHT_DIR, normal));
  if (hit)
    if (params.draw_depth == 1)
      color = vec4(1, 0, 0, 1) * lambert;
    else
      color = vec4(normal * 0.5 + 0.5, 1);
  else
    color = vec4(0.1, 0.1, 0.1, 1);
}
