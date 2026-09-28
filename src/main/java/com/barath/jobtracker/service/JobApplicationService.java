package com.barath.jobtracker.service;

import com.barath.jobtracker.entity.ApplicationStatus;
import com.barath.jobtracker.entity.JobApplication;
import com.barath.jobtracker.repository.JobApplicationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class JobApplicationService {

    private final JobApplicationRepository repository;

    public JobApplicationService(JobApplicationRepository repository) {
        this.repository = repository;
    }

    public List<JobApplication> getAllApplications() {
        return repository.findAll();
    }

    public List<JobApplication> searchByCompany(String company) {
    return repository.findByCompanyContainingIgnoreCase(company);
}

public List<JobApplication> searchByStatus(ApplicationStatus status) {
    return repository.findByStatus(status);
}

public List<JobApplication> searchByRole(String role) {
    return repository.findByRoleContainingIgnoreCase(role);
}

public List<JobApplication> searchByLocation(String location) {
    return repository.findByLocationContainingIgnoreCase(location);
}

public List<JobApplication> searchApplications(
        String company,
        String role,
        String location,
        ApplicationStatus status) {

    return repository.searchApplications(company, role, location, status);
}

public long getCountByStatus(ApplicationStatus status) {
    return repository.countByStatus(status);
}

    public JobApplication getApplicationById(Long id) {
        return repository.findById(id).orElse(null);
    }

    public JobApplication createApplication(JobApplication application) {
        return repository.save(application);
    }

    public JobApplication updateApplication(Long id, JobApplication application) {
        JobApplication existing = repository.findById(id).orElse(null);

        if (existing == null) {
            return null;
        }

        existing.setCompany(application.getCompany());
        existing.setRole(application.getRole());
        existing.setLocation(application.getLocation());
        existing.setStatus(application.getStatus());
        existing.setDateApplied(application.getDateApplied());
        existing.setSalary(application.getSalary());

        return repository.save(existing);
    }

    public void deleteApplication(Long id) {
        repository.deleteById(id);
    }
}

