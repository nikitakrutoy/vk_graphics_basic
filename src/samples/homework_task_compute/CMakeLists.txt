set(RENDER_SOURCE
        scan_compute.cpp)

add_executable(scan_compute main.cpp ${VK_UTILS_SRC} ${RENDER_SOURCE})

if(CMAKE_SYSTEM_NAME STREQUAL Windows)
    set_target_properties(scan_compute PROPERTIES VS_DEBUGGER_WORKING_DIRECTORY "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}")

    target_link_libraries(scan_compute PRIVATE project_options
                          volk project_warnings)
else()
    target_link_libraries(scan_compute PRIVATE project_options
                          volk project_warnings) #
endif()