package com.barath.jobtracker.controller;

import com.barath.jobtracker.entity.ApplicationStatus;
import com.barath.jobtracker.service.JobApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final JobApplicationService service;

    public DashboardController(JobApplicationService service) {
        this.service = service;
    }

    @GetMapping("/stats")
    public Map<String, Long> getStats() {

        Map<String, Long> stats = new LinkedHashMap<>();

        for (ApplicationStatus status : ApplicationStatus.values()) {
            stats.put(status.name(), service.getCountByStatus(status));
        }

        return stats;
    }
}
