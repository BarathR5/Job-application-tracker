package com.barath.jobtracker.controller;

import com.barath.jobtracker.entity.JobApplication;
import com.barath.jobtracker.service.JobApplicationService;

import jakarta.validation.Valid;
import jakarta.validation.Valid;

import com.barath.jobtracker.entity.ApplicationStatus;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/applications")
public class JobApplicationController {

    private final JobApplicationService service;

    public JobApplicationController(JobApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public List<JobApplication> getAllApplications() {
        return service.getAllApplications();
    }

    @GetMapping("/search")
public List<JobApplication> searchByCompany(@RequestParam String company) {
    return service.searchByCompany(company);
}

@GetMapping("/status")
public List<JobApplication> searchByStatus(@RequestParam ApplicationStatus status) {
    return service.searchByStatus(status);
}

@GetMapping("/role")
public List<JobApplication> searchByRole(@RequestParam String role) {
    return service.searchByRole(role);
}

@GetMapping("/location")
public List<JobApplication> searchByLocation(@RequestParam String location) {
    return service.searchByLocation(location);
}

@GetMapping("/search/advanced")
public List<JobApplication> searchApplications(
        @RequestParam(required = false) String company,
        @RequestParam(required = false) String role,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) ApplicationStatus status) {

    return service.searchApplications(company, role, location, status);
}

   @GetMapping("/{id}")
public ResponseEntity<JobApplication> getApplicationById(@PathVariable Long id) {

    JobApplication application = service.getApplicationById(id);

    if (application == null) {
        return ResponseEntity.notFound().build();
    }

    return ResponseEntity.ok(application);
}

    @PostMapping
public ResponseEntity<JobApplication> createApplication(
        @Valid @RequestBody JobApplication application) {

    JobApplication createdApplication = service.createApplication(application);

    return ResponseEntity.status(201).body(createdApplication);
}
    @PutMapping("/{id}")
public ResponseEntity<JobApplication> updateApplication(
        @PathVariable Long id,
        @Valid @RequestBody JobApplication application) {

    JobApplication updatedApplication = service.updateApplication(id, application);

    if (updatedApplication == null) {
        return ResponseEntity.notFound().build();
    }

    return ResponseEntity.ok(updatedApplication);
}

    @DeleteMapping("/{id}")
public ResponseEntity<Void> deleteApplication(@PathVariable Long id) {

    JobApplication application = service.getApplicationById(id);

    if (application == null) {
        return ResponseEntity.notFound().build();
    }

    service.deleteApplication(id);

    return ResponseEntity.noContent().build();
}
}
